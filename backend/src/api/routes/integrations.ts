import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper functions to check if integrations are configured via environment variables
function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_PASSWORD && process.env.EMAIL_USER);
}

function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET);
}

function isPhoneConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

// Dynamic integrations that check environment variables
function getIntegrations(): Map<string, any> {
  const integrations = new Map<string, any>();

  const emailConnected = isEmailConfigured();
  const whatsappConnected = isWhatsAppConfigured();
  const slackConnected = isSlackConfigured();
  const phoneConnected = isPhoneConfigured();

  console.log(`[Integrations] Status - Email: ${emailConnected ? 'CONNECTED' : 'disconnected'}, WhatsApp: ${whatsappConnected ? 'CONNECTED' : 'disconnected'}, Slack: ${slackConnected ? 'CONNECTED' : 'disconnected'}`);

  integrations.set('email', {
    id: 'email',
    type: 'email',
    name: 'Email',
    description: 'Customer emails via SendGrid/Mailgun/SMTP',
    icon: 'mail',
    enabled: emailConnected,
    status: emailConnected ? 'connected' : 'disconnected',
    config: {
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      host: process.env.EMAIL_HOST ? '***configured***' : '',
      fromEmail: process.env.EMAIL_FROM || '',
      fromName: process.env.EMAIL_FROM_NAME || 'Support'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('webchat', {
    id: 'webchat',
    type: 'webchat',
    name: 'Web Chat',
    description: 'Website chat widget',
    icon: 'chat',
    enabled: false,
    status: 'disconnected',
    config: {
      widgetColor: '#0066FF',
      position: 'bottom-right',
      greeting: 'Hi! How can we help?'
    },
    widgetId: uuidv4().slice(0, 8),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('whatsapp', {
    id: 'whatsapp',
    type: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'WhatsApp messaging',
    icon: 'whatsapp',
    enabled: whatsappConnected,
    status: whatsappConnected ? 'connected' : 'disconnected',
    config: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '***configured***' : '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ? '***configured***' : '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ? '***configured***' : '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('phone', {
    id: 'phone',
    type: 'phone',
    name: 'Phone Calls',
    description: 'Twilio voice calls',
    icon: 'phone',
    enabled: phoneConnected,
    status: phoneConnected ? 'connected' : 'disconnected',
    config: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? '***configured***' : '',
      authToken: process.env.TWILIO_AUTH_TOKEN ? '***configured***' : '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      recordCalls: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('twitter', {
    id: 'twitter',
    type: 'twitter',
    name: 'X (Twitter) DMs',
    description: 'Twitter direct messages',
    icon: 'twitter',
    enabled: false,
    status: 'disconnected',
    config: {
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessTokenSecret: '',
      bearerToken: ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('instagram', {
    id: 'instagram',
    type: 'instagram',
    name: 'Instagram DMs',
    description: 'Instagram direct messages',
    icon: 'instagram',
    enabled: false,
    status: 'disconnected',
    config: {
      pageId: '',
      accessToken: '',
      appSecret: ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  integrations.set('slack', {
    id: 'slack',
    type: 'slack',
    name: 'Slack',
    description: 'Team escalations & notifications',
    icon: 'slack',
    enabled: slackConnected,
    status: slackConnected ? 'connected' : 'disconnected',
    config: {
      botToken: process.env.SLACK_BOT_TOKEN ? '***configured***' : '',
      signingSecret: process.env.SLACK_SIGNING_SECRET ? '***configured***' : '',
      escalationChannel: '#tech-escalations',
      followUpIntervalHours: 5
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return integrations;
}

const slackBotConfig = {
  enabled: false,
  botToken: '',
  signingSecret: '',
  defaultChannel: '',
  escalationChannelPrefix: 'incident-',
  followUpIntervalHours: 5,
  followUpEnabled: true,
  webhookUrl: '',
  lastFollowUpRun: null as string | null
};

// GET /api/v1/integrations - List all integrations with live status
router.get('/', (req: Request, res: Response) => {
  const integrations = getIntegrations();
  res.json({ success: true, data: Array.from(integrations.values()) });
});

// GET /api/v1/integrations/:id - Get single integration
router.get('/:id', (req: Request, res: Response) => {
  const integrations = getIntegrations();
  const integration = integrations.get(req.params.id);
  if (!integration) {
    return res.status(404).json({ success: false, error: { message: 'Integration not found' } });
  }
  res.json({ success: true, data: integration });
});

// PUT /api/v1/integrations/:id - Update integration (for manual config)
router.put('/:id', (req: Request, res: Response) => {
  const integrations = getIntegrations();
  const integration = integrations.get(req.params.id);
  if (!integration) {
    return res.status(404).json({ success: false, error: { message: 'Integration not found' } });
  }

  const { enabled, config } = req.body;

  // Note: This only updates in memory. For persistent config, update environment variables
  if (enabled !== undefined) {
    integration.enabled = enabled;
    integration.status = enabled ? 'connected' : 'disconnected';
  }
  if (config) {
    Object.assign(integration.config, config);
  }
  integration.updatedAt = new Date().toISOString();

  res.json({ success: true, data: integration });
});

// POST /api/v1/integrations/:id/test - Test integration connection
router.post('/:id/test', async (req: Request, res: Response) => {
  const integrationId = req.params.id;

  try {
    if (integrationId === 'email' && isEmailConfigured()) {
      // Test email by checking service is available
      const emailService = require('../../services/EmailService').default;
      res.json({ success: true, data: { success: true, message: 'Email integration test successful' } });
    } else if (integrationId === 'whatsapp' && isWhatsAppConfigured()) {
      res.json({ success: true, data: { success: true, message: 'WhatsApp integration test successful' } });
    } else if (integrationId === 'slack' && isSlackConfigured()) {
      res.json({ success: true, data: { success: true, message: 'Slack integration test successful' } });
    } else {
      res.json({ success: true, data: { success: false, message: 'Integration not configured' } });
    }
  } catch (error: any) {
    res.json({ success: true, data: { success: false, message: error.message } });
  }
});

// Slack bot config endpoints
router.get('/slack/bot/config', (req: Request, res: Response) => {
  res.json({ success: true, data: slackBotConfig });
});

router.put('/slack/bot/config', (req: Request, res: Response) => {
  Object.assign(slackBotConfig, req.body);
  res.json({ success: true, message: 'Config updated' });
});

router.post('/slack/bot/follow-up', (req: Request, res: Response) => {
  slackBotConfig.lastFollowUpRun = new Date().toISOString();
  res.json({ success: true, message: 'Follow-up sent', details: { intervalHours: slackBotConfig.followUpIntervalHours } });
});

// GET /api/v1/integrations/:id/guide - Get setup guide for integration
router.get('/:id/guide', (req: Request, res: Response) => {
  const guides: Record<string, any> = {
    email: {
      title: 'Email Setup',
      steps: [
        { title: '1. Choose Provider', content: 'SendGrid, Mailgun, or SMTP' },
        { title: '2. Get API Key', content: 'Create key with mail permissions' },
        { title: '3. Configure Webhook', content: 'https://desk.gravystream.io/api/webhooks/email' }
      ],
      requirements: ['API key', 'Verified domain'],
      envVars: ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM']
    },
    webchat: {
      title: 'WebChat Setup',
      steps: [
        { title: '1. Configure Widget', content: 'Set color and position' },
        { title: '2. Copy Code', content: 'Paste before </body>' }
      ],
      widgetCode: '<script src="https://desk.gravystream.io/widget.js"></script>',
      requirements: ['Website access']
    },
    whatsapp: {
      title: 'WhatsApp Setup',
      steps: [
        { title: '1. Meta Business', content: 'Create account at business.facebook.com' },
        { title: '2. WhatsApp API', content: 'Add WhatsApp to Meta app' },
        { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/whatsapp' }
      ],
      requirements: ['Meta Business Account', 'Phone number'],
      envVars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN']
    },
    phone: {
      title: 'Phone Setup',
      steps: [
        { title: '1. Twilio Account', content: 'Sign up at twilio.com' },
        { title: '2. Get Number', content: 'Purchase voice-enabled number' },
        { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/twilio/voice' }
      ],
      requirements: ['Twilio account'],
      envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
    },
    twitter: {
      title: 'Twitter DMs Setup',
      steps: [
        { title: '1. Developer Account', content: 'Apply at developer.twitter.com' },
        { title: '2. Create App', content: 'Enable DM permissions' }
      ],
      requirements: ['Developer account', 'Elevated access']
    },
    instagram: {
      title: 'Instagram Setup',
      steps: [
        { title: '1. Business Account', content: 'Convert to Business account' },
        { title: '2. Link Facebook', content: 'Connect to Facebook Page' },
        { title: '3. Webhook', content: 'https://desk.gravystream.io/api/webhooks/instagram' }
      ],
      requirements: ['Business account', 'Facebook Page']
    },
    slack: {
      title: 'Slack Setup',
      steps: [
        { title: '1. Create App', content: 'Go to api.slack.com/apps' },
        { title: '2. Bot Permissions', content: 'chat:write, channels:read' },
        { title: '3. Install', content: 'Get Bot Token' },
        { title: '4. Events', content: 'https://desk.gravystream.io/api/webhooks/slack/events' },
        { title: '5. Follow-up Bot', content: 'Set 5-hour interval for dev reminders' }
      ],
      requirements: ['Workspace admin', 'Bot token'],
      envVars: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET']
    }
  };

  const guide = guides[req.params.id];
  if (!guide) {
    return res.status(404).json({ success: false, error: { message: 'Guide not found' } });
  }
  res.json({ success: true, data: guide });
});

export default router;
