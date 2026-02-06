import { Router, Request, Response } from 'express';
import { getPool } from '../../utils/database';
import { resolutionRepository } from '../../repositories/ResolutionRepository';
import { swarmRepository } from '../../repositories/SwarmRepository';
import { getSlackService } from '../../services/SlackService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/v1/conversations - List all conversations from database
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { channel, status, limit = 50 } = req.query;

    let query = `
      SELECT
        'conv_' || c.id::text as id,
        'cust_' || c.customer_id::text as "customerId",
        c.channel,
        c.status,
        c.subject,
        c.priority,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        cu.name as "customerName",
        cu.email as "customerEmail"
      FROM conversations c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (channel && channel !== 'all') {
      params.push(channel);
      query += ` AND c.channel = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    params.push(parseInt(limit as string) || 50);
    query += ` ORDER BY c.updated_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('[Conversations] Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// GET /api/v1/conversations/:id - Get single conversation
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    // Handle both "conv_1" format and plain "1" format
    const convId = req.params.id.replace('conv_', '');
    const result = await pool.query(
      `SELECT
        'conv_' || c.id::text as id,
        'cust_' || c.customer_id::text as "customerId",
        c.channel,
        c.status,
        c.subject,
        c.priority,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        cu.name as "customerName",
        cu.email as "customerEmail",
        cu.phone as "customerPhone"
      FROM conversations c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      WHERE c.id = $1`,
      [convId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[Conversations] Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// GET /api/v1/conversations/:id/messages - Get messages for a conversation
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    // Handle both "conv_1" format and plain "1" format
    const convId = req.params.id.replace('conv_', '');

    // First verify conversation exists
    const convResult = await pool.query(
      'SELECT id FROM conversations WHERE id = $1',
      [convId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    // Get messages
    const result = await pool.query(
      `SELECT
        'msg_' || id::text as id,
        'conv_' || conversation_id::text as "conversationId",
        content,
        sender_type as "senderType",
        sender_id as "senderId",
        channel,
        metadata,
        created_at as "createdAt"
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC`,
      [convId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('[Conversations] Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// POST /api/v1/conversations/:id/messages - Send a reply message
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { content } = req.body;
    // Handle both "conv_1" format and plain "1" format
    const convId = req.params.id.replace('conv_', '');

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CONTENT', message: 'Message content is required' }
      });
    }

    // Get conversation with customer info
    const convResult = await pool.query(
      `SELECT c.*, cu.email as customer_email, cu.phone as customer_phone, cu.name as customer_name
       FROM conversations c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       WHERE c.id = $1`,
      [convId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    const conversation = convResult.rows[0];
    const messageId = uuidv4();
    let sendResult = { success: false, error: '' };

    // Send via appropriate channel
    if (conversation.channel === 'whatsapp' && conversation.customer_phone) {
      try {
        const whatsappService = require('../../services/WhatsAppService').default;
        const phone = conversation.customer_phone.replace(/\D/g, '');
        await whatsappService.sendMessage(phone, content);
        sendResult = { success: true, error: '' };
        console.log(`[Conversations] WhatsApp message sent to ${phone}`);
      } catch (err: any) {
        console.error('[Conversations] WhatsApp send error:', err);
        sendResult = { success: false, error: err.message };
      }
    } else if (conversation.channel === 'email' && conversation.customer_email) {
      try {
        const emailService = require('../../services/EmailService').default;
        await emailService.sendEmail({
          to: conversation.customer_email,
          subject: `Re: ${conversation.subject || 'Your inquiry'}`,
          text: content,
          html: `<p>${content.replace(/\n/g, '<br>')}</p>`
        });
        sendResult = { success: true, error: '' };
        console.log(`[Conversations] Email sent to ${conversation.customer_email}`);
      } catch (err: any) {
        console.error('[Conversations] Email send error:', err);
        sendResult = { success: false, error: err.message };
      }
    } else {
      // For other channels (chat, etc.) just store the message
      sendResult = { success: true, error: '' };
    }

    // Store the message in database regardless of send status
    await pool.query(
      `INSERT INTO messages (id, conversation_id, content, sender_type, sender_id, channel, metadata, created_at)
       VALUES ($1, $2, $3, 'agent', 'system', $4, $5, NOW())`,
      [
        messageId,
        convId,
        content,
        conversation.channel,
        JSON.stringify({ sendSuccess: sendResult.success, sendError: sendResult.error })
      ]
    );

    // Update conversation timestamp
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [convId]
    );

    const newMessage = {
      id: 'msg_' + messageId,
      conversationId: 'conv_' + convId,
      content,
      senderType: 'agent',
      senderId: 'system',
      channel: conversation.channel,
      createdAt: new Date().toISOString(),
      sendSuccess: sendResult.success
    };

    if (!sendResult.success && sendResult.error) {
      return res.status(207).json({
        success: true,
        data: newMessage,
        warning: `Message saved but delivery failed: ${sendResult.error}`
      });
    }

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error: any) {
    console.error('[Conversations] Error sending message:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SEND_ERROR', message: error.message }
    });
  }
});

// PUT /api/v1/conversations/:id/status - Update conversation status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { status } = req.body;

    if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid status value' }
      });
    }

    const result = await pool.query(
      `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[Conversations] Error updating status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: error.message }
    });
  }
});

// POST /api/v1/conversations/:id/escalate - Escalate conversation
router.post('/:id/escalate', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;
    const { reason, issueType = 'technical', owningTeam = 'engineering', priority = 'P2', createSwarm = false } = req.body;

    // Verify conversation exists
    const convResult = await pool.query(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    const conversation = convResult.rows[0];

    const existingResolution = await resolutionRepository.getByConversationId(conversationId);
    if (existingResolution) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_ESCALATED', message: 'Conversation already has an active resolution' },
        data: existingResolution,
      });
    }

    const resolution = await resolutionRepository.create({
      conversationId,
      issueType,
      owningTeam,
      priority,
      title: reason || conversation.subject || 'Escalated issue',
      description: 'Escalated from conversation ' + conversationId,
    });

    await resolutionRepository.addUpdate(
      resolution.id,
      'escalation',
      'Escalated from conversation: ' + (reason || 'No reason provided'),
      'system',
      'internal',
      'app'
    );

    let swarm = null;

    if (createSwarm) {
      const slackService = getSlackService();
      const channel = await slackService.createSwarmChannel(
        resolution.id,
        resolution.title || 'Resolution ' + resolution.id,
        resolution.description || issueType + ' issue - ' + owningTeam,
        priority
      );

      if (channel) {
        swarm = await swarmRepository.create({
          resolutionId: resolution.id,
          slackChannelId: channel.id,
          slackChannelName: channel.name,
          slackChannelUrl: channel.url,
        });
      }
    }

    res.status(201).json({ success: true, data: { resolution, swarm } });
  } catch (error: any) {
    console.error('[Conversations] Error escalating:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ESCALATE_ERROR', message: error.message }
    });
  }
});

export default router;
