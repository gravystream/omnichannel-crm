import { Router, Request, Response } from 'express';
import { getPool } from '../../utils/database';

const router = Router();

// GET /api/v1/inbox - Get all inbox conversations with latest message
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { channel, status } = req.query;

    let query = `
      SELECT
        c.id,
        c.subject,
        c.channel,
        c.status,
        c.priority,
        c.customer_id as "customerId",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        cu.name as "customerName",
        cu.email as "customerEmail",
        cu.phone as "customerPhone",
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = c.id) as "messageCount"
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

    query += ` ORDER BY c.updated_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('[Inbox] Error fetching inbox:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INBOX_ERROR', message: error.message }
    });
  }
});

// GET /api/v1/inbox/stats - Get inbox statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END)::int as open,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved,
        COUNT(CASE WHEN channel = 'email' THEN 1 END)::int as email,
        COUNT(CASE WHEN channel = 'whatsapp' THEN 1 END)::int as whatsapp,
        COUNT(CASE WHEN channel = 'chat' THEN 1 END)::int as chat
      FROM conversations
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error: any) {
    console.error('[Inbox] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'STATS_ERROR', message: error.message }
    });
  }
});

export default router;
