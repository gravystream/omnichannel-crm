/**
 * WhatsApp Business API Adapter
 *
 * Handles WhatsApp messaging via the official Business API (Cloud or On-Premise).
 * Supports text, media, templates, and interactive messages.
 */

import { BaseChannelAdapter, AdapterConfig, OutboundMessage, DeliveryResult } from './BaseChannelAdapter';
import { Channel, NormalizedMessage, MessageDirection } from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from '../core/EventBus';
import * as crypto from 'crypto';

export interface WhatsAppConfig extends AdapterConfig {
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  appSecret: string;
  baseUrl?: string; // For on-premise
}

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts' | 'interactive' | 'button' | 'reaction';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>;
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { payload: string; text: string };
  reaction?: { message_id: string; emoji: string };
  context?: { from: string; id: string };
}

interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export class WhatsAppAdapter extends BaseChannelAdapter {
  private processedMessageIds: Set<string> = new Set();
  private mediaCache: Map<string, { url: string; expiresAt: Date }> = new Map();

  constructor(config: WhatsAppConfig, logger: Logger, eventBus: EventBus) {
    super(config, logger, eventBus);
  }

  async initialize(): Promise<void> {
    this.logActivity('Initializing WhatsApp adapter');

    // Verify credentials
    await this.verifyCredentials();

    // Start media cache cleanup
    setInterval(() => this.cleanupMediaCache(), 60000);
  }

  private async verifyCredentials(): Promise<void> {
    const config = this.config as WhatsAppConfig;

    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`WhatsApp API verification failed: ${response.status}`);
      }

      this.logActivity('WhatsApp credentials verified');
    } catch (error) {
      this.logError('Credential verification failed', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  async processWebhook(
    payload: any,
    headers?: Record<string, string>
  ): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];

    // Handle webhook verification (GET request)
    if (payload['hub.mode'] === 'subscribe') {
      return []; // Handled by verifyWebhook
    }

    // Process messages from webhook
    const entry = payload.entry?.[0];
    if (!entry) return messages;

    const changes = entry.changes?.[0];
    if (!changes || changes.field !== 'messages') return messages;

    const value = changes.value;

    // Get contact info
    const contacts = value.contacts || [];
    const contactMap = new Map<string, WhatsAppContact>();
    contacts.forEach((c: WhatsAppContact) => contactMap.set(c.wa_id, c));

    // Process each message
    const waMessages = value.messages || [];
    for (const msg of waMessages) {
      // Deduplicate
      if (this.processedMessageIds.has(msg.id)) {
        continue;
      }
      this.processedMessageIds.add(msg.id);

      const contact = contactMap.get(msg.from);
      const normalized = await this.normalizeMessage(msg, contact);
      messages.push(normalized);
    }

    // Process status updates
    const statuses = value.statuses || [];
    for (const status of statuses) {
      await this.processStatusUpdate(status);
    }

    return messages;
  }

  private async normalizeMessage(
    msg: WhatsAppMessage,
    contact?: WhatsAppContact
  ): Promise<NormalizedMessage> {
    let content = '';
    let contentType: 'text' | 'html' | 'markdown' | 'voice_transcript' = 'text';
    const attachments: NormalizedMessage['attachments'] = [];

    switch (msg.type) {
      case 'text':
        content = msg.text?.body || '';
        break;

      case 'image':
        if (msg.image) {
          const mediaUrl = await this.getMediaUrl(msg.image.id);
          attachments.push({
            url: mediaUrl,
            filename: 'image.jpg',
            contentType: msg.image.mime_type,
          });
          content = msg.image.caption || '[Image]';
        }
        break;

      case 'video':
        if (msg.video) {
          const mediaUrl = await this.getMediaUrl(msg.video.id);
          attachments.push({
            url: mediaUrl,
            filename: 'video.mp4',
            contentType: msg.video.mime_type,
          });
          content = msg.video.caption || '[Video]';
        }
        break;

      case 'audio':
        if (msg.audio) {
          const mediaUrl = await this.getMediaUrl(msg.audio.id);
          attachments.push({
            url: mediaUrl,
            filename: 'audio.ogg',
            contentType: msg.audio.mime_type,
          });
          content = '[Voice Message]';
          // Could transcribe here
        }
        break;

      case 'document':
        if (msg.document) {
          const mediaUrl = await this.getMediaUrl(msg.document.id);
          attachments.push({
            url: mediaUrl,
            filename: msg.document.filename || 'document',
            contentType: msg.document.mime_type,
          });
          content = msg.document.caption || `[Document: ${msg.document.filename}]`;
        }
        break;

      case 'location':
        if (msg.location) {
          content = `📍 Location: ${msg.location.name || ''} ${msg.location.address || ''}\n` +
            `Coordinates: ${msg.location.latitude}, ${msg.location.longitude}`;
        }
        break;

      case 'contacts':
        if (msg.contacts) {
          content = msg.contacts
            .map((c) => `👤 ${c.name.formatted_name}: ${c.phones?.[0]?.phone || 'No phone'}`)
            .join('\n');
        }
        break;

      case 'interactive':
        if (msg.interactive) {
          if (msg.interactive.button_reply) {
            content = `[Button: ${msg.interactive.button_reply.title}]`;
          } else if (msg.interactive.list_reply) {
            content = `[Selected: ${msg.interactive.list_reply.title}]`;
          }
        }
        break;

      case 'button':
        content = msg.button?.text || '[Button Click]';
        break;

      case 'reaction':
        content = `[Reaction: ${msg.reaction?.emoji}]`;
        break;
    }

    return this.createNormalizedMessage({
      channelMessageId: msg.id,
      direction: MessageDirection.INBOUND,
      senderIdentity: {
        phone: `+${msg.from}`,
        name: contact?.profile.name,
        socialId: msg.from,
      },
      content,
      contentType,
      attachments,
      conversationHints: {
        socialPostId: msg.context?.id, // Reply to specific message
      },
      channelMetadata: {
        waId: msg.from,
        messageType: msg.type,
        context: msg.context,
      },
      timestamp: new Date(parseInt(msg.timestamp) * 1000),
    });
  }

  private async processStatusUpdate(status: {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    errors?: Array<{ code: number; title: string }>;
  }): Promise<void> {
    // Emit status update event
    await this.eventBus.publish('message.status_updated', {
      channelMessageId: status.id,
      channel: Channel.WHATSAPP,
      status: status.status,
      recipientId: status.recipient_id,
      timestamp: new Date(parseInt(status.timestamp) * 1000),
      errors: status.errors,
    });
  }

  // ============================================================================
  // OUTBOUND MESSAGES
  // ============================================================================

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    const config = this.config as WhatsAppConfig;

    try {
      // Format phone number (remove + and spaces)
      const recipientPhone = message.recipientId.replace(/[\s+-]/g, '');

      // Determine message type
      let messagePayload: any;

      if (message.attachments && message.attachments.length > 0) {
        // Media message
        const attachment = message.attachments[0];
        const mediaType = this.getMediaType(attachment.contentType);

        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: mediaType,
          [mediaType]: {
            link: attachment.url,
            caption: message.content,
          },
        };
      } else if (message.metadata?.template) {
        // Template message
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'template',
          template: message.metadata.template,
        };
      } else if (message.metadata?.interactive) {
        // Interactive message (buttons/list)
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'interactive',
          interactive: message.metadata.interactive,
        };
      } else {
        // Text message
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: message.content,
          },
        };
      }

      // Send message
      const response = await fetch(
        `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'WhatsApp API error');
      }

      this.logActivity('WhatsApp message sent', {
        to: recipientPhone,
        messageId: result.messages?.[0]?.id,
      });

      return {
        success: true,
        channelMessageId: result.messages?.[0]?.id,
        deliveredAt: new Date(),
      };
    } catch (error) {
      this.logError('WhatsApp send failed', error as Error, {
        to: message.recipientId,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private getMediaType(contentType: string): 'image' | 'video' | 'audio' | 'document' {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  // ============================================================================
  // MEDIA HANDLING
  // ============================================================================

  private async getMediaUrl(mediaId: string): Promise<string> {
    // Check cache
    const cached = this.mediaCache.get(mediaId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.url;
    }

    const config = this.config as WhatsAppConfig;

    // Get media URL from WhatsApp
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to get media URL');
    }

    // Cache the URL (WhatsApp URLs expire)
    this.mediaCache.set(mediaId, {
      url: result.url,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    return result.url;
  }

  private cleanupMediaCache(): void {
    const now = new Date();
    for (const [id, cached] of this.mediaCache) {
      if (cached.expiresAt < now) {
        this.mediaCache.delete(id);
      }
    }
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  verifyWebhook(payload: any, signature?: string): boolean {
    const config = this.config as WhatsAppConfig;

    // Handle webhook verification challenge
    if (payload['hub.mode'] === 'subscribe') {
      return payload['hub.verify_token'] === config.webhookVerifyToken;
    }

    // Verify signature
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', config.appSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  /**
   * Get verification challenge response
   */
  getVerificationResponse(payload: any): string | null {
    const config = this.config as WhatsAppConfig;

    if (
      payload['hub.mode'] === 'subscribe' &&
      payload['hub.verify_token'] === config.webhookVerifyToken
    ) {
      return payload['hub.challenge'];
    }

    return null;
  }

  // ============================================================================
  // TEMPLATE MESSAGES
  // ============================================================================

  async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      conversationId: '',
      content: '',
      contentType: 'text',
      recipientId: recipientPhone,
      metadata: {
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
    });
  }

  // ============================================================================
  // INTERACTIVE MESSAGES
  // ============================================================================

  async sendButtonMessage(
    recipientPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      conversationId: '',
      content: bodyText,
      contentType: 'text',
      recipientId: recipientPhone,
      metadata: {
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      },
    });
  }

  async sendListMessage(
    recipientPhone: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      conversationId: '',
      content: bodyText,
      contentType: 'text',
      recipientId: recipientPhone,
      metadata: {
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      },
    });
  }
}

export default WhatsAppAdapter;
