/**
 * Base Channel Adapter
 *
 * Abstract base class for all channel adapters.
 * Handles normalization of inbound messages and routing of outbound messages.
 */

import { Channel, NormalizedMessage, MessageDirection, SenderType } from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from '../core/EventBus';

export interface AdapterConfig {
  channelId: string;
  channelType: Channel;
  credentials: Record<string, any>;
  webhookSecret?: string;
  enabled: boolean;
}

export interface OutboundMessage {
  conversationId: string;
  content: string;
  contentType: 'text' | 'html' | 'markdown';
  attachments?: Array<{
    url: string;
    filename: string;
    contentType: string;
  }>;
  recipientId: string;
  metadata?: Record<string, any>;
}

export interface DeliveryResult {
  success: boolean;
  channelMessageId?: string;
  error?: string;
  deliveredAt?: Date;
}

export abstract class BaseChannelAdapter {
  protected config: AdapterConfig;
  protected logger: Logger;
  protected eventBus: EventBus;

  constructor(config: AdapterConfig, logger: Logger, eventBus: EventBus) {
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  // ============================================================================
  // ABSTRACT METHODS (Must be implemented by subclasses)
  // ============================================================================

  /**
   * Initialize the adapter (connect to external services, set up webhooks, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Process an incoming webhook payload and return normalized messages
   */
  abstract processWebhook(payload: any, headers?: Record<string, string>): Promise<NormalizedMessage[]>;

  /**
   * Send a message through this channel
   */
  abstract sendMessage(message: OutboundMessage): Promise<DeliveryResult>;

  /**
   * Verify webhook signature if applicable
   */
  abstract verifyWebhook(payload: any, signature?: string): boolean;

  /**
   * Get the channel type
   */
  getChannelType(): Channel {
    return this.config.channelType;
  }

  /**
   * Check if adapter is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Create a normalized message from raw data
   */
  protected createNormalizedMessage(data: {
    channelMessageId?: string;
    direction: MessageDirection;
    senderIdentity: NormalizedMessage['senderIdentity'];
    content: string;
    contentHtml?: string;
    contentType: 'text' | 'html' | 'markdown' | 'voice_transcript';
    attachments?: NormalizedMessage['attachments'];
    conversationHints?: Partial<NormalizedMessage['conversationHints']>;
    channelMetadata?: Record<string, any>;
    timestamp?: Date;
  }): NormalizedMessage {
    return {
      id: this.generateMessageId(),
      channel: this.config.channelType,
      channelMessageId: data.channelMessageId,
      direction: data.direction,
      senderType: data.direction === MessageDirection.INBOUND ? SenderType.CUSTOMER : SenderType.AGENT,
      senderIdentity: data.senderIdentity,
      content: data.content,
      contentHtml: data.contentHtml,
      contentType: data.contentType,
      attachments: data.attachments || [],
      replyToMessageId: undefined,
      threadId: undefined,
      conversationHints: {
        emailThreadId: data.conversationHints?.emailThreadId,
        emailSubject: data.conversationHints?.emailSubject,
        socialPostId: data.conversationHints?.socialPostId,
        sessionId: data.conversationHints?.sessionId,
      },
      channelMetadata: data.channelMetadata || {},
      timestamp: data.timestamp || new Date(),
      receivedAt: new Date(),
    };
  }

  /**
   * Generate a unique message ID
   */
  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit a webhook event
   */
  protected async emitWebhookEvent(message: NormalizedMessage): Promise<void> {
    await this.eventBus.publish('channel.webhook', {
      channel: this.config.channelType,
      channelId: this.config.channelId,
      message,
    });
  }

  /**
   * Log adapter activity
   */
  protected logActivity(action: string, data?: Record<string, any>): void {
    this.logger.info(`[${this.config.channelType}] ${action}`, {
      channelId: this.config.channelId,
      ...data,
    });
  }

  /**
   * Log adapter error
   */
  protected logError(action: string, error: Error, data?: Record<string, any>): void {
    this.logger.error(`[${this.config.channelType}] ${action} failed`, {
      channelId: this.config.channelId,
      error: error.message,
      stack: error.stack,
      ...data,
    });
  }
}

export default BaseChannelAdapter;
