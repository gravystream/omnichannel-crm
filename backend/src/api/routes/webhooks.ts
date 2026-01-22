/**
 * Webhook Routes - Channel Integrations
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

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
router.post('/email/sendgrid', (req: Request, res: Response) => {
  // SendGrid Inbound Parse webhook
  const {
    from,
    to,
    subject,
    text,
    html,
    headers,
    attachments
  } = req.body;

  console.log('Email received from SendGrid:', { from, to, subject });

  // Extract thread ID from subject or headers
  let threadId = null;
  const reMatch = subject?.match(/\[Thread:([^\]]+)\]/);
  if (reMatch) {
    threadId = reMatch[1];
  }

  // In production: create or continue conversation
  const emailData = {
    from: typeof from === 'string' ? from : from?.email,
    to: typeof to === 'string' ? to : to?.email,
    subject,
    body: text || html,
    threadId,
    hasAttachments: !!attachments,
    receivedAt: new Date().toISOString()
  };

  console.log('Processed email:', emailData);

  res.json({ success: true, message: 'Email processed' });
});

// POST /api/webhooks/email/mailgun
router.post('/email/mailgun', (req: Request, res: Response) => {
  // Mailgun webhook
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

  res.json({ success: true, message: 'Email processed' });
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

router.post('/whatsapp', (req: Request, res: Response) => {
  const { object, entry } = req.body;

  if (object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  console.log('WhatsApp webhook received');

  entry?.forEach((e: any) => {
    e.changes?.forEach((change: any) => {
      if (change.field === 'messages') {
        const messages = change.value?.messages || [];
        const contacts = change.value?.contacts || [];

        messages.forEach((msg: any) => {
          const contact = contacts.find((c: any) => c.wa_id === msg.from);
          console.log('WhatsApp message:', {
            from: msg.from,
            contactName: contact?.profile?.name,
            type: msg.type,
            text: msg.text?.body || msg.type,
            timestamp: msg.timestamp
          });

          // In production: create or continue conversation
        });

        // Handle status updates
        const statuses = change.value?.statuses || [];
        statuses.forEach((status: any) => {
          console.log('WhatsApp status:', {
            messageId: status.id,
            status: status.status, // sent, delivered, read
            recipientId: status.recipient_id
          });
        });
      }
    });
  });

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
