/**
 * Email Service
 * Service for sending emails via Zoho SMTP
 */

import * as nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

class EmailService {
  private config: EmailConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Default to Zoho SMTP settings
    const port = parseInt(process.env.EMAIL_PORT || '465');

    this.config = {
      host: process.env.EMAIL_HOST || 'smtp.zoho.com',
      port: port,
      // Zoho uses SSL on port 465, TLS on port 587
      secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : port === 465,
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || '',
      fromEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
      fromName: process.env.EMAIL_FROM_NAME || 'Support',
    };

    this.initTransporter();
  }

  private initTransporter(): void {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Email not configured - missing required environment variables');
      return;
    }

    console.log('[EmailService] Initializing with Zoho SMTP:', {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      user: this.config.user,
      from: this.config.fromEmail,
    });

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      // Zoho specific settings
      tls: {
        rejectUnauthorized: true,
      },
    });
  }

  /**
   * Check if email is configured
   */
  isConfigured(): boolean {
    return !!(this.config.host && this.config.user && this.config.password);
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured() || !this.transporter) {
      throw new Error('Email is not configured. Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASSWORD');
    }

    try {
      // For Zoho, the from email must match the authenticated user or an alias
      const fromEmail = this.config.fromEmail || this.config.user;

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.config.fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      if (options.cc) mailOptions.cc = options.cc;
      if (options.bcc) mailOptions.bcc = options.bcc;
      if (options.replyTo) mailOptions.replyTo = options.replyTo;
      if (options.attachments) mailOptions.attachments = options.attachments;

      console.log('[EmailService] Sending email via Zoho:', {
        to: options.to,
        subject: options.subject,
        from: fromEmail,
      });

      const result = await this.transporter.sendMail(mailOptions);

      console.log('[EmailService] Email sent successfully:', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      console.error('[EmailService] Send error:', error.message);
      throw error;
    }
  }

  /**
   * Verify the transporter connection
   */
  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[EmailService] Zoho SMTP connection verified');
      return true;
    } catch (error: any) {
      console.error('[EmailService] Zoho SMTP verification failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export default new EmailService();
