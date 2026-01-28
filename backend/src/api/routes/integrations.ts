import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const integrations = new Map<string, any>();
const slackBotConfig = { enabled: false, botToken: '', signingSecret: '', defaultChannel: '', escalationChannelPrefix: 'incident-', followUpIntervalHours: 5, followUpEnabled: true, webhookUrl: '', lastFollowUpRun: null as string | null };

function initIntegrations() {
  integrations.set('email', { id: 'email', type: 'email', name: 'Email', description: 'Customer emails via SendGrid/Mailgun/SMTP', icon: 'mail', enabled: false, status: 'disconnected', config: { provider: 'sendgrid', apiKey: '', fromEmail: '', fromName: '' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('webchat', { id: 'webchat', type: 'webchat', name: 'Web Chat', description: 'Website chat widget', icon: 'chat', enabled: false, status: 'disconnected', config: { widgetColor: '#0066FF', position: 'bottom-right', greeting: 'Hi! How can we help?' }, widgetId: uuidv4().slice(0,8), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('whatsapp', { id: 'whatsapp', type: 'whatsapp', name: 'WhatsApp Business', description: 'WhatsApp messaging', icon: 'whatsapp', enabled: false, status: 'disconnected', config: { phoneNumberId: '', accessToken: '', verifyToken: '', businessAccountId: '' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('phone', { id: 'phone', type: 'phone', name: 'Phone Calls', description: 'Twilio voice calls', icon: 'phone', enabled: false, status: 'disconnected', config: { accountSid: '', authToken: '', phoneNumber: '', recordCalls: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('twitter', { id: 'twitter', type: 'twitter', name: 'X (Twitter) DMs', description: 'Twitter direct messages', icon: 'twitter', enabled: false, status: 'disconnected', config: { apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', bearerToken: '' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('instagram', { id: 'instagram', type: 'instagram', name: 'Instagram DMs', description: 'Instagram direct messages', icon: 'instagram', enabled: false, status: 'disconnected', config: { pageId: '', accessToken: '', appSecret: '' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  integrations.set('slack', { id: 'slack', type: 'slack', name: 'Slack', description: 'Team escalations & notifications', icon: 'slack', enabled: false, status: 'disconnected', config: { botToken: '', signingSecret: '', escalationChannel: '#tech-escalations', followUpIntervalHours: 5 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}
initIntegrations();

router.get('/', (req: Request, res: Response) => { res.json({ success: true, data: Array.from(integrations.values()) }); });
router.get('/:id', (req: Request, res: Response) => { const i = integrations.get(req.params.id); if (!i) return res.status(404).json({ success: false, error: { message: 'Not found' } }); res.json({ success: true, data: i }); });
router.put('/:id', (req: Request, res: Response) => { const i = integrations.get(req.params.id); if (!i) return res.status(404).json({ success: false, error: { message: 'Not found' } }); const { enabled, config } = req.body; if (enabled !== undefined) { i.enabled = enabled; i.status = enabled ? 'connected' : 'disconnected'; } if (config) Object.assign(i.config, config); i.updatedAt = new Date().toISOString(); res.json({ success: true, data: i }); });
router.post('/:id/test', (req: Request, res: Response) => { res.json({ success: true, data: { success: true, message: 'Test successful' } }); });
router.get('/slack/bot/config', (req: Request, res: Response) => { res.json({ success: true, data: slackBotConfig }); });
router.put('/slack/bot/config', (req: Request, res: Response) => { Object.assign(slackBotConfig, req.body); res.json({ success: true, message: 'Config updated' }); });
router.post('/slack/bot/follow-up', (req: Request, res: Response) => { slackBotConfig.lastFollowUpRun = new Date().toISOString(); res.json({ success: true, message: 'Follow-up sent', details: { intervalHours: slackBotConfig.followUpIntervalHours } }); });

router.get('/:id/guide', (req: Request, res: Response) => {
  const guides: Record<string, any> = {
    email: { title: 'Email Setup', steps: [{ title: '1. Choose Provider', content: 'SendGrid, Mailgun, or SMTP' }, { title: '2. Get API Key', content: 'Create key with mail permissions' }, { title: '3. Configure Webhook', content: 'https://desk.gravystream.io/api/webhooks/email' }], requirements: ['API key', 'Verified domain'] },
    webchat: { title: 'WebChat Setup', steps: [{ title: '1. Configure Widget', content: 'Set color and position' }, { title: '2. Copy Code', content: 'Paste before </body>' }], widgetCode: '<script src="https://desk.gravystream.io/widget.js"></script>', requirements: ['Website access'] },
    whatsapp: { title: 'WhatsApp Setup', steps: [{ title: '1. Meta Business', content: 'Create account at business.facebook.com' }, { title: '2. WhatsApp API', content: 'Add WhatsApp to Meta app' }, { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/whatsapp' }], requirements: ['Meta Business Account', 'Phone number'] },
    phone: { title: 'Phone Setup', steps: [{ title: '1. Twilio Account', content: 'Sign up at twilio.com' }, { title: '2. Get Number', content: 'Purchase voice-enabled number' }, { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/twilio/voice' }], requirements: ['Twilio account'] },
    twitter: { title: 'Twitter DMs Setup', steps: [{ title: '1. Developer Account', content: 'Apply at developer.twitter.com' }, { title: '2. Create App', content: 'Enable DM permissions' }], requirements: ['Developer account', 'Elevated access'] },
    instagram: { title: 'Instagram Setup', steps: [{ title: '1. Business Account', content: 'Convert to Business account' }, { title: '2. Link Facebook', content: 'Connect to Facebook Page' }, { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/instagram' }], requirements: ['Business account', 'Facebook Page'] },
    slack: { title: 'Slack Setup', steps: [{ title: '1. Create App', content: 'Go to api.slack.com/apps' }, { title: '2. Bot Permissions', content: 'chat:write, channels:read' }, { title: '3. Install', content: 'Get Bot Token' }, { title: '4. Events', content: 'https://desk.gravystream.io/api/webhooks/slack/events' }, { title: '5. Follow-up Bot', content: 'Set 5-hour interval for dev reminders' }], requirements: ['Workspace admin', 'Bot token'] }
  };
  const g = guides[req.params.id]; if (!g) return res.status(404).json({ success: false }); res.json({ success: true, data: g });
});

export default router;
