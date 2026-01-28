export interface SlackConfig { botToken: string; signingSecret?: string; defaultChannelPrefix?: string; appId?: string; }
export interface SlackChannelInfo { id: string; name: string; url: string; }
export interface SlackMessageOptions { text: string; blocks?: any[]; threadTs?: string; unfurlLinks?: boolean; unfurlMedia?: boolean; }
export interface SlackChannelOptions { topic?: string; purpose?: string; isPrivate?: boolean; }

export class SlackService {
  private botToken: string | null = null;
  private config: SlackConfig | null = null;
  private enabled: boolean = false;
  private baseUrl = 'https://slack.com/api';

  constructor(config?: SlackConfig) { if (config) { this.initialize(config); } }
  initialize(config: SlackConfig): void { this.config = config; this.botToken = config.botToken; this.enabled = true; console.log('[SlackService] Initialized with bot token'); }
  isEnabled(): boolean { return this.enabled && this.botToken !== null; }

  private async slackRequest(method: string, body: any): Promise<any> {
    if (!this.botToken) { throw new Error('Slack bot token not configured'); }
    const response = await fetch(this.baseUrl + '/' + method, { method: 'POST', headers: { 'Authorization': 'Bearer ' + this.botToken, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!data.ok) { throw new Error('Slack API error: ' + data.error); }
    return data;
  }

  async createChannel(name: string, options: SlackChannelOptions = {}): Promise<SlackChannelInfo> {
    if (!this.isEnabled()) { console.log('[SlackService] Service not enabled, simulating channel creation'); return this.simulateChannelCreation(name); }
    try {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 80);
      const createResult = await this.slackRequest('conversations.create', { name: normalizedName, is_private: options.isPrivate || false });
      const channelId = createResult.channel.id;
      if (options.topic) { await this.slackRequest('conversations.setTopic', { channel: channelId, topic: options.topic }); }
      if (options.purpose) { await this.slackRequest('conversations.setPurpose', { channel: channelId, purpose: options.purpose }); }
      console.log('[SlackService] Channel created: #' + normalizedName + ' (' + channelId + ')');
      return { id: channelId, name: normalizedName, url: 'https://slack.com/app_redirect?channel=' + channelId };
    } catch (error: any) {
      console.error('[SlackService] Error creating channel:', error.message);
      if (error.message?.includes('name_taken')) { return this.findChannelByName(name); }
      return this.simulateChannelCreation(name);
    }
  }

  async findChannelByName(name: string): Promise<SlackChannelInfo> {
    if (!this.isEnabled()) { return this.simulateChannelCreation(name); }
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 80);
    try {
      const result = await this.slackRequest('conversations.list', { types: 'public_channel,private_channel', limit: 1000 });
      const channel = result.channels?.find((c: any) => c.name === normalizedName);
      if (channel && channel.id) { return { id: channel.id, name: channel.name || normalizedName, url: 'https://slack.com/app_redirect?channel=' + channel.id }; }
      throw new Error('Channel not found: ' + normalizedName);
    } catch (error: any) { console.error('[SlackService] Error finding channel:', error.message); return this.simulateChannelCreation(name); }
  }

  async postMessage(channel: string, options: SlackMessageOptions): Promise<any> {
    if (!this.isEnabled()) { console.log('[SlackService] Simulating message to ' + channel + ':', options.text); return { ok: true, ts: Date.now().toString() }; }
    try {
      const result = await this.slackRequest('chat.postMessage', { channel, text: options.text, blocks: options.blocks, thread_ts: options.threadTs, unfurl_links: options.unfurlLinks ?? false, unfurl_media: options.unfurlMedia ?? true });
      return result;
    } catch (error: any) { console.error('[SlackService] Error posting message:', error.message); return { ok: false, error: error.message }; }
  }

  async archiveChannel(channel: string): Promise<boolean> {
    if (!this.isEnabled()) { console.log('[SlackService] Simulating archive of channel ' + channel); return true; }
    try { await this.slackRequest('conversations.archive', { channel }); console.log('[SlackService] Channel archived: ' + channel); return true; }
    catch (error: any) { if (error.message?.includes('already_archived')) return true; console.error('[SlackService] Error archiving channel:', error.message); return false; }
  }

  async createSwarmChannel(resolutionId: string, title: string, description: string, priority: string): Promise<SlackChannelInfo | null> {
    const prefix = this.config?.defaultChannelPrefix || 'incident';
    const dateStr = new Date().toISOString().slice(0, 10);
    const channelName = prefix + '-' + dateStr + '-' + resolutionId.slice(-8);
    try {
      const channel = await this.createChannel(channelName, { topic: priority + ' - ' + title, purpose: description.slice(0, 250) });
      await this.postMessage(channel.id, { text: 'Incident Channel Created', blocks: [{ type: 'header', text: { type: 'plain_text', text: priority + ' - ' + title } }, { type: 'section', text: { type: 'mrkdwn', text: description } }, { type: 'divider' }, { type: 'section', fields: [{ type: 'mrkdwn', text: '*Resolution ID:*\n' + resolutionId }, { type: 'mrkdwn', text: '*Priority:*\n' + priority }] }] });
      return channel;
    } catch (error: any) { console.error('[SlackService] Error creating swarm channel:', error.message); return this.simulateChannelCreation(channelName); }
  }

  async postResolutionUpdate(channelId: string, update: { resolutionId: string; status: string; message: string; author: string; isCustomerFacing?: boolean }): Promise<boolean> {
    const emoji = update.isCustomerFacing ? '' : '';
    const customerTag = update.isCustomerFacing ? ' *(sent to customer)*' : '';
    const result = await this.postMessage(channelId, { text: emoji + ' Update: ' + update.message, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: emoji + ' *Update*' + customerTag + '\n' + update.message } }, { type: 'context', elements: [{ type: 'mrkdwn', text: 'Status: *' + update.status + '* | By: ' + update.author }] }] });
    return result?.ok ?? false;
  }

  private simulateChannelCreation(name: string): SlackChannelInfo {
    const id = 'C' + Math.random().toString(36).substring(2, 12).toUpperCase();
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 80);
    console.log('[SlackService] Simulated channel: #' + normalizedName + ' (' + id + ')');
    return { id, name: normalizedName, url: 'https://slack.com/app_redirect?channel=' + id };
  }
}

let slackServiceInstance: SlackService | null = null;
export function getSlackService(): SlackService {
  if (!slackServiceInstance) {
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (botToken) { slackServiceInstance = new SlackService({ botToken, signingSecret: process.env.SLACK_SIGNING_SECRET, defaultChannelPrefix: process.env.SLACK_CHANNEL_PREFIX || 'incident', appId: process.env.SLACK_APP_ID }); }
    else { slackServiceInstance = new SlackService(); console.log('[SlackService] Running in simulation mode (no SLACK_BOT_TOKEN)'); }
  }
  return slackServiceInstance;
}
export default SlackService;
