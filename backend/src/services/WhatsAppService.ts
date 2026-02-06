/**
 * WhatsApp Service
 * Simple service for sending WhatsApp messages via Meta Business API
 */

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

class WhatsAppService {
  private config: WhatsAppConfig;

  constructor() {
    this.config = {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    };
  }

  /**
   * Check if WhatsApp is configured
   */
  isConfigured(): boolean {
    return !!(this.config.accessToken && this.config.phoneNumberId);
  }

  /**
   * Send a text message via WhatsApp
   * @param to - Phone number (digits only, with country code)
   * @param message - Message content
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp is not configured. Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
    }

    // Clean phone number - remove non-digits
    const phone = to.replace(/\D/g, '');

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'text',
            text: {
              preview_url: true,
              body: message,
            },
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[WhatsAppService] API Error:', result);
        throw new Error(result.error?.message || `WhatsApp API error: ${response.status}`);
      }

      console.log('[WhatsAppService] Message sent successfully:', {
        to: phone,
        messageId: result.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error: any) {
      console.error('[WhatsAppService] Send error:', error);
      throw error;
    }
  }

  /**
   * Send a template message via WhatsApp
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp is not configured');
    }

    const phone = to.replace(/\D/g, '');

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode },
              components,
            },
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'WhatsApp API error');
      }

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error: any) {
      console.error('[WhatsAppService] Template send error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new WhatsAppService();
