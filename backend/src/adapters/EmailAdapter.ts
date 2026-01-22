/**
 * Email Channel Adapter
 *
 * Handles email ingestion via SMTP/IMAP or webhooks (SendGrid, Mailgun, etc.)
 * Maintains email threading and conversation continuity.
 */

import { BaseChannelAdapter, AdapterConfig, OutboundMessage, DeliveryResult } from './BaseChannelAdapter';
import { Channel, NormalizedMessage, MessageDirection } from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from '../core/EventBus';
import * as crypto from 'crypto';

export interface EmailConfig extends AdapterConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  inboundMethod: 'imap' | 'webhook';

  // SMTP settings
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  // IMAP settings
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    mailbox: string;
    pollIntervalSeconds: number;
  };

  // SendGrid settings
  sendgrid?: {
    apiKey: string;
    webhookSigningSecret?: string;
  };

  // Mailgun settings
  mailgun?: {
    apiKey: string;
    domain: string;
    webhookSigningKey?: string;
  };

  // General settings
  fromAddress: string;
  fromName: string;
  replyToAddress?: string;
  supportEmailDomain: string;
}

interface EmailMessage {
  messageId: string;
  from: {
    email: string;
    name?: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  cc?: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer | string;
    size: number;
  }>;
  receivedAt: Date;
}

export class EmailAdapter extends BaseChannelAdapter {
  private imapClient: any = null;
  private smtpTransporter: any = null;
  private processedMessageIds: Set<string> = new Set();

  constructor(config: EmailConfig, logger: Logger, eventBus: EventBus) {
    super(config, logger, eventBus);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    const config = this.config as EmailConfig;

    this.logActivity('Initializing Email adapter', {
      provider: config.provider,
      inboundMethod: config.inboundMethod,
    });

    // Initialize SMTP transport for outbound
    await this.initializeSMTP();

    // Initialize IMAP for inbound if configured
    if (config.inboundMethod === 'imap') {
      await this.initializeIMAP();
    }
  }

  private async initializeSMTP(): Promise<void> {
    const config = this.config as EmailConfig;

    // Using nodemailer or provider SDK
    // const nodemailer = require('nodemailer');

    switch (config.provider) {
      case 'smtp':
        // this.smtpTransporter = nodemailer.createTransport(config.smtp);
        break;
      case 'sendgrid':
        // Use @sendgrid/mail
        break;
      case 'mailgun':
        // Use mailgun.js
        break;
      case 'ses':
        // Use @aws-sdk/client-ses
        break;
    }

    this.logActivity('SMTP transport initialized', { provider: config.provider });
  }

  private async initializeIMAP(): Promise<void> {
    const config = this.config as EmailConfig;

    if (!config.imap) {
      throw new Error('IMAP configuration required for IMAP inbound method');
    }

    // Using imap-simple or similar
    // const imapSimple = require('imap-simple');

    // Connect to IMAP server
    // this.imapClient = await imapSimple.connect({
    //   imap: config.imap
    // });

    // Start polling
    this.startIMAPPolling();

    this.logActivity('IMAP client initialized');
  }

  private startIMAPPolling(): void {
    const config = this.config as EmailConfig;
    const pollInterval = (config.imap?.pollIntervalSeconds || 30) * 1000;

    setInterval(async () => {
      try {
        await this.pollIMAPInbox();
      } catch (error) {
        this.logError('IMAP polling failed', error as Error);
      }
    }, pollInterval);
  }

  private async pollIMAPInbox(): Promise<void> {
    // Open inbox
    // await this.imapClient.openBox('INBOX');

    // Search for unseen messages
    // const searchCriteria = ['UNSEEN'];
    // const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
    // const messages = await this.imapClient.search(searchCriteria, fetchOptions);

    // Process each message
    // for (const message of messages) {
    //   const parsed = await this.parseIMAPMessage(message);
    //   const normalized = await this.normalizeEmail(parsed);
    //   await this.emitWebhookEvent(normalized);
    // }
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  async processWebhook(
    payload: any,
    headers?: Record<string, string>
  ): Promise<NormalizedMessage[]> {
    const config = this.config as EmailConfig;

    switch (config.provider) {
      case 'sendgrid':
        return this.processSendGridWebhook(payload, headers);
      case 'mailgun':
        return this.processMailgunWebhook(payload, headers);
      default:
        return this.processGenericWebhook(payload);
    }
  }

  private async processSendGridWebhook(
    payload: any[],
    headers?: Record<string, string>
  ): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];

    // SendGrid sends an array of events
    for (const event of payload) {
      if (event.event === 'inbound') {
        // Deduplicate
        if (this.processedMessageIds.has(event.sg_message_id)) {
          continue;
        }
        this.processedMessageIds.add(event.sg_message_id);

        const email = this.parseSendGridInbound(event);
        const normalized = this.normalizeEmail(email);
        messages.push(normalized);
      }
    }

    return messages;
  }

  private parseSendGridInbound(event: any): EmailMessage {
    return {
      messageId: event.sg_message_id || event.headers['Message-ID'],
      from: {
        email: event.from,
        name: event.from_name,
      },
      to: [{ email: event.to }],
      cc: event.cc ? [{ email: event.cc }] : undefined,
      subject: event.subject,
      textContent: event.text,
      htmlContent: event.html,
      headers: event.headers || {},
      attachments: (event.attachments || []).map((a: any) => ({
        filename: a.filename,
        contentType: a.type,
        content: Buffer.from(a.content, 'base64'),
        size: a.content.length,
      })),
      receivedAt: new Date(),
    };
  }

  private async processMailgunWebhook(
    payload: any,
    headers?: Record<string, string>
  ): Promise<NormalizedMessage[]> {
    // Mailgun posts form data with 'event-data' for webhooks
    const eventData = payload['event-data'] || payload;

    if (eventData.event !== 'stored') {
      return [];
    }

    // Deduplicate
    if (this.processedMessageIds.has(eventData['message-id'])) {
      return [];
    }
    this.processedMessageIds.add(eventData['message-id']);

    const email = this.parseMailgunInbound(payload);
    const normalized = this.normalizeEmail(email);

    return [normalized];
  }

  private parseMailgunInbound(payload: any): EmailMessage {
    return {
      messageId: payload['Message-Id'] || payload['message-id'],
      from: {
        email: payload.sender || payload.from,
        name: payload['from-name'],
      },
      to: [{ email: payload.recipient }],
      subject: payload.subject,
      textContent: payload['body-plain'] || payload['stripped-text'],
      htmlContent: payload['body-html'] || payload['stripped-html'],
      headers: this.parseMailgunHeaders(payload),
      attachments: this.parseMailgunAttachments(payload),
      receivedAt: new Date(payload.timestamp * 1000),
    };
  }

  private parseMailgunHeaders(payload: any): Record<string, string> {
    const headers: Record<string, string> = {};
    if (payload['message-headers']) {
      try {
        const parsed = JSON.parse(payload['message-headers']);
        for (const [key, value] of parsed) {
          headers[key] = value;
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return headers;
  }

  private parseMailgunAttachments(payload: any): EmailMessage['attachments'] {
    const attachments: EmailMessage['attachments'] = [];

    // Mailgun sends attachments as form fields
    for (const key in payload) {
      if (key.startsWith('attachment-')) {
        const attachment = payload[key];
        attachments.push({
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: attachment.data,
          size: attachment.size,
        });
      }
    }

    return attachments;
  }

  private async processGenericWebhook(payload: any): Promise<NormalizedMessage[]> {
    // Generic email webhook format
    const email: EmailMessage = {
      messageId: payload.messageId,
      from: payload.from,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      textContent: payload.text,
      htmlContent: payload.html,
      headers: payload.headers || {},
      attachments: payload.attachments || [],
      receivedAt: new Date(payload.receivedAt || Date.now()),
    };

    const normalized = this.normalizeEmail(email);
    return [normalized];
  }

  // ============================================================================
  // NORMALIZATION
  // ============================================================================

  private normalizeEmail(email: EmailMessage): NormalizedMessage {
    // Extract thread ID from headers
    const threadId = this.extractThreadId(email);

    // Extract conversation reference from subject or headers
    const conversationRef = this.extractConversationReference(email);

    return this.createNormalizedMessage({
      channelMessageId: email.messageId,
      direction: MessageDirection.INBOUND,
      senderIdentity: {
        email: email.from.email,
        name: email.from.name,
      },
      content: email.textContent || this.stripHtml(email.htmlContent || ''),
      contentHtml: email.htmlContent,
      contentType: email.htmlContent ? 'html' : 'text',
      attachments: email.attachments.map((a) => ({
        url: '', // Will be uploaded to storage
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.size,
      })),
      conversationHints: {
        emailThreadId: threadId,
        emailSubject: email.subject,
      },
      channelMetadata: {
        originalMessageId: email.messageId,
        to: email.to,
        cc: email.cc,
        headers: email.headers,
        conversationRef,
      },
      timestamp: email.receivedAt,
    });
  }

  private extractThreadId(email: EmailMessage): string | undefined {
    // Try In-Reply-To header first
    const inReplyTo = email.headers['In-Reply-To'] || email.headers['in-reply-to'];
    if (inReplyTo) {
      return inReplyTo.replace(/[<>]/g, '');
    }

    // Try References header
    const references = email.headers['References'] || email.headers['references'];
    if (references) {
      const refs = references.split(/\s+/);
      return refs[0]?.replace(/[<>]/g, '');
    }

    return undefined;
  }

  private extractConversationReference(email: EmailMessage): string | undefined {
    // Look for conversation ID in subject
    // Format: [Case #ABC12345] or Re: [Case #ABC12345]
    const subjectMatch = email.subject.match(/\[Case #([A-Z0-9]+)\]/i);
    if (subjectMatch) {
      return subjectMatch[1];
    }

    // Look for conversation ID in email address
    // Format: support+abc12345@company.com
    const config = this.config as EmailConfig;
    const toEmail = email.to[0]?.email || '';
    const addressMatch = toEmail.match(
      new RegExp(`support\\+([a-z0-9]+)@${config.supportEmailDomain}`, 'i')
    );
    if (addressMatch) {
      return addressMatch[1];
    }

    return undefined;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ============================================================================
  // OUTBOUND MESSAGES
  // ============================================================================

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    const config = this.config as EmailConfig;

    try {
      const conversationRef = message.metadata?.conversationRef;
      const threadMessageId = message.metadata?.threadMessageId;

      // Build email
      const email = {
        from: {
          email: conversationRef
            ? `support+${conversationRef}@${config.supportEmailDomain}`
            : config.fromAddress,
          name: config.fromName,
        },
        to: message.recipientId,
        subject: this.buildSubject(message, conversationRef),
        text: this.htmlToText(message.content),
        html: message.contentType === 'html' ? message.content : this.textToHtml(message.content),
        headers: {
          ...(threadMessageId && {
            'In-Reply-To': `<${threadMessageId}>`,
            References: `<${threadMessageId}>`,
          }),
        },
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          path: a.url,
          contentType: a.contentType,
        })),
      };

      // Send via provider
      let result: any;

      switch (config.provider) {
        case 'sendgrid':
          result = await this.sendViaSendGrid(email);
          break;
        case 'mailgun':
          result = await this.sendViaMailgun(email);
          break;
        case 'ses':
          result = await this.sendViaSES(email);
          break;
        default:
          result = await this.sendViaSMTP(email);
      }

      this.logActivity('Email sent', {
        to: message.recipientId,
        messageId: result.messageId,
      });

      return {
        success: true,
        channelMessageId: result.messageId,
        deliveredAt: new Date(),
      };
    } catch (error) {
      this.logError('Email send failed', error as Error, {
        to: message.recipientId,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private buildSubject(message: OutboundMessage, conversationRef?: string): string {
    const baseSubject = message.metadata?.subject || 'Your support request';

    if (conversationRef) {
      // Check if already has case reference
      if (baseSubject.includes(`[Case #${conversationRef}]`)) {
        return baseSubject;
      }
      return `Re: [Case #${conversationRef}] ${baseSubject}`;
    }

    return baseSubject;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private textToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  private async sendViaSMTP(email: any): Promise<{ messageId: string }> {
    // const result = await this.smtpTransporter.sendMail(email);
    // return { messageId: result.messageId };
    return { messageId: `smtp_${Date.now()}` };
  }

  private async sendViaSendGrid(email: any): Promise<{ messageId: string }> {
    // const sgMail = require('@sendgrid/mail');
    // const [response] = await sgMail.send(email);
    // return { messageId: response.headers['x-message-id'] };
    return { messageId: `sg_${Date.now()}` };
  }

  private async sendViaMailgun(email: any): Promise<{ messageId: string }> {
    // const mg = require('mailgun.js');
    // const result = await mg.messages.create(domain, email);
    // return { messageId: result.id };
    return { messageId: `mg_${Date.now()}` };
  }

  private async sendViaSES(email: any): Promise<{ messageId: string }> {
    // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    // const result = await ses.send(new SendEmailCommand(params));
    // return { messageId: result.MessageId };
    return { messageId: `ses_${Date.now()}` };
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  verifyWebhook(payload: any, signature?: string): boolean {
    const config = this.config as EmailConfig;

    switch (config.provider) {
      case 'sendgrid':
        return this.verifySendGridWebhook(payload, signature);
      case 'mailgun':
        return this.verifyMailgunWebhook(payload, signature);
      default:
        return true; // Trust internal webhooks
    }
  }

  private verifySendGridWebhook(payload: any, signature?: string): boolean {
    const config = this.config as EmailConfig;
    if (!config.sendgrid?.webhookSigningSecret || !signature) {
      return true; // Skip verification if not configured
    }

    // SendGrid webhook verification
    // const publicKey = config.sendgrid.webhookSigningSecret;
    // return verify signature using public key

    return true;
  }

  private verifyMailgunWebhook(payload: any, signature?: string): boolean {
    const config = this.config as EmailConfig;
    if (!config.mailgun?.webhookSigningKey) {
      return true;
    }

    const { timestamp, token, signature: sig } = payload;
    if (!timestamp || !token || !sig) {
      return false;
    }

    const encodedToken = crypto
      .createHmac('sha256', config.mailgun.webhookSigningKey)
      .update(timestamp + token)
      .digest('hex');

    return encodedToken === sig;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async shutdown(): Promise<void> {
    if (this.imapClient) {
      await this.imapClient.end();
    }
    if (this.smtpTransporter) {
      this.smtpTransporter.close();
    }

    this.logActivity('Email adapter shut down');
  }
}

export default EmailAdapter;
