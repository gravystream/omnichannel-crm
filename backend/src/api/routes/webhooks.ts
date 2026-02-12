/**
 * Webhook Routes - Channel Integrations
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPool } from '../../utils/database';
import { getEventBus } from '../../core/EventBus';

// Helper function to find or create customer
async function findOrCreateCustomer(pool: any, email: string | null, phone: string | null, name: string | null) {
  // Try to find existing customer by email or phone
  let customer = null;

  if (email) {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    if (result.rows.length > 0) customer = result.rows[0];
  }

  if (!customer && phone) {
    const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
    if (result.rows.length > 0) customer = result.rows[0];
  }

  // Create new customer if not found (let DB auto-generate ID)
  if (!customer) {
    const result = await pool.query(
      `INSERT INTO customers (email, phone, name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [email, phone, name || 'Unknown']
    );
    customer = result.rows[0];
    console.log('[Webhook] Created new customer:', customer.id);
  }

  return customer;
}

// Helper function to find or create conversation
async function findOrCreateConversation(pool: any, customerId: number, channel: string, subject: string | null) {
  // Try to find existing open conversation for this customer and channel
  const result = await pool.query(
    `SELECT * FROM conversations
     WHERE customer_id = $1 AND channel = $2 AND status IN ('open', 'pending')
     ORDER BY updated_at DESC LIMIT 1`,
    [customerId, channel]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create new conversation (let DB auto-generate ID)
  const newConv = await pool.query(
    `INSERT INTO conversations (customer_id, channel, status, subject, priority, created_at, updated_at)
     VALUES ($1, $2, 'open', $3, 'normal', NOW(), NOW())
     RETURNING *`,
    [customerId, channel, subject || `${channel.charAt(0).toUpperCase() + channel.slice(1)} Inquiry`]
  );
  console.log('[Webhook] Created new conversation:', newConv.rows[0].id);
  return newConv.rows[0];
}

// Helper function to create message
async function createMessage(pool: any, conversationId: number, content: string, senderType: string, channel: string) {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, content, sender_type, channel, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [conversationId, content, senderType, channel]
  );

  // Update conversation timestamp
  await pool.query(
    'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
    [conversationId]
  );

  console.log('[Webhook] Created message:', result.rows[0].id);
  return result.rows[0].id;
}

const router = Router();

// Middleware to verify webhook signatures
function verifySlackSignature(req: Request, res: Response, next: Function) {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;

  if (!signature || !timestamp) {
    // For demo, allow unsigned requests
    console.log('Warning: Slack webhook received without signature');
    return next();
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET || 'demo-secret';
  const baseString = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const expectedSignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  if (signature === expectedSignature) {
    next();
  } else {
    console.log('Warning: Invalid Slack signature - allowing for demo');
    next(); // Allow in demo mode
  }
}

// POST /api/webhooks/slack/events
router.post('/slack/events', verifySlackSignature, (req: Request, res: Response) => {
  const { type, event, challenge } = req.body;

  // Handle Slack URL verification
  if (type === 'url_verification') {
    return res.json({ challenge });
  }

  console.log('Slack event received:', type, event?.type);

  // Handle different event types
  if (type === 'event_callback') {
    switch (event?.type) {
      case 'message':
        // Handle message in incident channel
        if (event.channel_type === 'channel' && !event.bot_id) {
          console.log(`Slack message in ${event.channel}: ${event.text?.substring(0, 50)}`);
          // In production: sync to resolution timeline
        }
        break;

      case 'reaction_added':
        // Handle reactions (e.g., :white_check_mark: to mark resolved)
        if (event.reaction === 'white_check_mark') {
          console.log(`Resolution confirmed via reaction in ${event.item.channel}`);
        }
        break;

      case 'channel_created':
        console.log(`New channel created: ${event.channel?.name}`);
        break;

      default:
        console.log(`Unhandled Slack event type: ${event?.type}`);
    }
  }

  res.json({ ok: true });
});

// POST /api/webhooks/slack/interactive
router.post('/slack/interactive', verifySlackSignature, (req: Request, res: Response) => {
  const payload = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body;

  console.log('Slack interactive event:', payload.type);

  switch (payload.type) {
    case 'block_actions':
      // Handle button clicks, select menus, etc.
      const action = payload.actions?.[0];
      if (action) {
        console.log(`Button clicked: ${action.action_id} with value ${action.value}`);

        if (action.action_id === 'claim_incident') {
          // Assign incident to user who clicked
          return res.json({
            response_type: 'in_channel',
            text: `<@${payload.user.id}> has claimed this incident.`
          });
        }

        if (action.action_id === 'escalate_incident') {
          return res.json({
            response_type: 'in_channel',
            text: `Incident escalated by <@${payload.user.id}>. Paging on-call.`
          });
        }
      }
      break;

    case 'view_submission':
      // Handle modal submissions
      console.log('Modal submitted:', payload.view?.callback_id);
      break;

    default:
      console.log(`Unhandled interactive type: ${payload.type}`);
  }

  res.json({ ok: true });
});

// POST /api/webhooks/email/sendgrid
router.post('/email/sendgrid', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const {
      from,
      to,
      subject,
      text,
      html,
      headers,
      attachments
    } = req.body;

    const fromEmail = typeof from === 'string' ? from : from?.email;
    const fromName = typeof from === 'string' ? from.split('@')[0] : from?.name;

    console.log('Email received from SendGrid:', { from: fromEmail, to, subject });

    // Create or find customer
    const customer = await findOrCreateCustomer(pool, fromEmail, null, fromName);

    // Create or find conversation
    const conversation = await findOrCreateConversation(pool, customer.id, 'email', subject);

    // Create message
    const content = text || html || '(No content)';
    const messageId = await createMessage(pool, conversation.id, content, 'customer', 'email');

    console.log('[Email Webhook] Processed email into conversation:', conversation.id);

    // Emit message.received event for AI processing
    const eventBus = getEventBus();
    await eventBus.publish('message.received', {
      messageId: messageId,
      conversationId: conversation.id,
      channel: 'email',
      direction: 'inbound',
      senderType: 'customer',
      customerId: customer.id,
    });

    res.json({ success: true, message: 'Email processed', conversationId: conversation.id });
  } catch (error: any) {
    console.error('[Email Webhook] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webhooks/email/mailgun
router.post('/email/mailgun', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const {
      sender,
      recipient,
      subject,
      'body-plain': bodyPlain,
      'body-html': bodyHtml,
      'Message-Id': messageId,
      'In-Reply-To': inReplyTo
    } = req.body;

    console.log('Email received from Mailgun:', { sender, recipient, subject });

    // Create or find customer
    const customer = await findOrCreateCustomer(pool, sender, null, sender?.split('@')[0]);

    // Create or find conversation
    const conversation = await findOrCreateConversation(pool, customer.id, 'email', subject);

    // Create message
    const content = bodyPlain || bodyHtml || '(No content)';
    const messageId = await createMessage(pool, conversation.id, content, 'customer', 'email');

    // Emit message.received event for AI processing
    const eventBus = getEventBus();
    await eventBus.publish('message.received', {
      messageId: messageId,
      conversationId: conversation.id,
      channel: 'email',
      direction: 'inbound',
      senderType: 'customer',
      customerId: customer.id,
    });

    res.json({ success: true, message: 'Email processed', conversationId: conversation.id });
  } catch (error: any) {
    console.error('[Mailgun Webhook] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webhooks/email/zoho - Zoho Mail webhook
router.post('/email/zoho', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const {
      fromAddress,
      from,
      toAddress,
      to,
      subject,
      content,
      textContent,
      htmlContent,
      sender,
      receivedTime
    } = req.body;

    const fromEmail = fromAddress || from || sender;
    const fromName = fromEmail?.split('@')[0];
    const emailContent = content || textContent || htmlContent || '(No content)';

    console.log('Email received from Zoho:', { from: fromEmail, to: toAddress || to, subject });

    // Create or find customer
    const customer = await findOrCreateCustomer(pool, fromEmail, null, fromName);

    // Create or find conversation
    const conversation = await findOrCreateConversation(pool, customer.id, 'email', subject);

    // Create message
    const messageId = await createMessage(pool, conversation.id, emailContent, 'customer', 'email');

    console.log('[Zoho Email Webhook] Processed email into conversation:', conversation.id);

    // Emit message.received event for AI processing
    const eventBus = getEventBus();
    await eventBus.publish('message.received', {
      messageId: messageId,
      conversationId: conversation.id,
      channel: 'email',
      direction: 'inbound',
      senderType: 'customer',
      customerId: customer.id,
    });

    res.json({ success: true, message: 'Email processed', conversationId: conversation.id });
  } catch (error: any) {
    console.error('[Zoho Email Webhook] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webhooks/email - Generic email webhook (works with any provider)
router.post('/email', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const {
      from,
      fromAddress,
      fromEmail,
      sender,
      to,
      toAddress,
      subject,
      text,
      textContent,
      body,
      content,
      html,
      htmlContent
    } = req.body;

    const email = from || fromAddress || fromEmail || sender;
    const name = email?.split('@')[0];
    const emailContent = text || textContent || body || content || html || htmlContent || '(No content)';
    const emailSubject = subject || 'Email Inquiry';

    console.log('Email received (generic):', { from: email, subject: emailSubject });

    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing from/sender email address' });
    }

    // Create or find customer
    const customer = await findOrCreateCustomer(pool, email, null, name);

    // Create or find conversation
    const conversation = await findOrCreateConversation(pool, customer.id, 'email', emailSubject);

    // Create message
    await createMessage(pool, conversation.id, emailContent, 'customer', 'email');

    console.log('[Email Webhook] Processed email into conversation:', conversation.id);

    res.json({ success: true, message: 'Email processed', conversationId: conversation.id });
  } catch (error: any) {
    console.error('[Email Webhook] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET/POST /api/webhooks/whatsapp
router.get('/whatsapp', (req: Request, res: Response) => {
  // WhatsApp webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'demo-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  res.status(403).send('Verification failed');
});

router.post('/whatsapp', async (req: Request, res: Response) => {
  const { object, entry } = req.body;

  if (object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  console.log('WhatsApp webhook received');

  try {
    const pool = getPool();

    for (const e of entry || []) {
      for (const change of e.changes || []) {
        if (change.field === 'messages') {
          const messages = change.value?.messages || [];
          const contacts = change.value?.contacts || [];

          for (const msg of messages) {
            const contact = contacts.find((c: any) => c.wa_id === msg.from);
            const phone = '+' + msg.from;
            const name = contact?.profile?.name || 'WhatsApp User';
            const content = msg.text?.body || msg.caption || `[${msg.type}]`;

            console.log('WhatsApp message:', {
              from: phone,
              contactName: name,
              type: msg.type,
              text: content
            });

            // Create or find customer
            const customer = await findOrCreateCustomer(pool, null, phone, name);

            // Create or find conversation
            const conversation = await findOrCreateConversation(pool, customer.id, 'whatsapp', 'WhatsApp Inquiry');

            // Create message
            await createMessage(pool, conversation.id, content, 'customer', 'whatsapp');

            console.log('[WhatsApp Webhook] Processed message into conversation:', conversation.id);
          }

          // Handle status updates
          const statuses = change.value?.statuses || [];
          statuses.forEach((status: any) => {
            console.log('WhatsApp status:', {
              messageId: status.id,
              status: status.status,
              recipientId: status.recipient_id
            });
          });
        }
      }
    }
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
  }

  res.sendStatus(200);
});

// POST /api/webhooks/twilio/sms
router.post('/twilio/sms', (req: Request, res: Response) => {
  const {
    From: from,
    To: to,
    Body: body,
    MessageSid: messageSid,
    NumMedia: numMedia
  } = req.body;

  console.log('SMS received from Twilio:', { from, to, body: body?.substring(0, 50) });

  // Return TwiML response
  res.type('text/xml');
  res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Message>Thank you for contacting us. A support agent will respond shortly.</Message>
    </Response>
  `);
});

// POST /api/webhooks/twilio/voice
router.post('/twilio/voice', (req: Request, res: Response) => {
  const {
    From: from,
    To: to,
    CallSid: callSid,
    CallStatus: callStatus
  } = req.body;

  console.log('Voice call from Twilio:', { from, to, callSid, callStatus });

  // Return TwiML response
  res.type('text/xml');
  res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">
        Thank you for calling. Please hold while we connect you to a support agent.
      </Say>
      <Enqueue waitUrl="/api/webhooks/twilio/wait">support</Enqueue>
    </Response>
  `);
});

// POST /api/webhooks/twilio/voice/status
router.post('/twilio/voice/status', (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body;

  console.log('Voice call status update:', { CallSid, CallStatus, CallDuration });

  res.sendStatus(200);
});

// POST /api/webhooks/facebook
router.get('/facebook', (req: Request, res: Response) => {
  // Facebook Messenger webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'demo-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Facebook webhook verified');
    return res.status(200).send(challenge);
  }

  res.status(403).send('Verification failed');
});

router.post('/facebook', (req: Request, res: Response) => {
  const { object, entry } = req.body;

  if (object !== 'page') {
    return res.sendStatus(404);
  }

  console.log('Facebook webhook received');

  entry?.forEach((e: any) => {
    e.messaging?.forEach((msg: any) => {
      const senderId = msg.sender?.id;
      const recipientId = msg.recipient?.id;

      if (msg.message) {
        console.log('Facebook message:', {
          from: senderId,
          text: msg.message.text,
          attachments: msg.message.attachments?.length || 0
        });
      }

      if (msg.postback) {
        console.log('Facebook postback:', {
          from: senderId,
          payload: msg.postback.payload
        });
      }
    });
  });

  res.sendStatus(200);
});

// POST /api/webhooks/instagram
router.post('/instagram', (req: Request, res: Response) => {
  // Instagram Direct webhook (uses same format as Facebook)
  const { object, entry } = req.body;

  console.log('Instagram webhook received:', object);

  entry?.forEach((e: any) => {
    e.messaging?.forEach((msg: any) => {
      console.log('Instagram message:', {
        from: msg.sender?.id,
        text: msg.message?.text
      });
    });
  });

  res.sendStatus(200);
});

// POST /api/webhooks/twitter
router.post('/twitter', (req: Request, res: Response) => {
  // Twitter Account Activity API webhook
  const { direct_message_events, users } = req.body;

  console.log('Twitter webhook received');

  direct_message_events?.forEach((event: any) => {
    if (event.type === 'message_create') {
      const senderId = event.message_create?.sender_id;
      const senderName = users?.[senderId]?.name;
      console.log('Twitter DM:', {
        from: senderName || senderId,
        text: event.message_create?.message_data?.text
      });
    }
  });

  res.sendStatus(200);
});

// CRC challenge for Twitter
router.get('/twitter', (req: Request, res: Response) => {
  const crcToken = req.query.crc_token as string;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || 'demo-secret';

  if (crcToken) {
    const hmac = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
    return res.json({ response_token: `sha256=${hmac}` });
  }

  res.status(400).send('No CRC token provided');
});

export default router;
