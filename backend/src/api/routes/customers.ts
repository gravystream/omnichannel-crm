/**
 * Customer Routes - PostgreSQL Connected
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../utils/database';

const router = Router();

// GET /api/customers - List all customers from PostgreSQL
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { search, tier, segment, page = '1', pageSize = '20' } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Tier filter (maps to sla_tier in frontend)
    if (tier) {
      conditions.push(`COALESCE(metadata->>'tier', 'standard') = $${paramIndex}`);
      values.push(tier);
      paramIndex++;
    }

    // Segment filter
    if (segment) {
      conditions.push(`metadata->>'segment' = $${paramIndex}`);
      values.push(segment);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await pool.query(`SELECT COUNT(*) FROM customers ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * size;

    // Fetch customers with conversation stats
    const dataQuery = `
      SELECT
        c.*,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id), 0) as total_conversations,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id AND status IN ('open', 'pending')), 0) as open_conversations
      FROM customers c
      ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(size, offset);

    const result = await pool.query(dataQuery, values);

    // Map to frontend Customer format
    const customers = result.rows.map(mapCustomerRow);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        pageSize: size,
        totalItems: total,
        totalPages: Math.ceil(total / size)
      }
    });
  } catch (error: any) {
    console.error('[Customers] Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id - Get single customer
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    let customerId = req.params.id;

    // Handle cust_X format
    if (customerId.startsWith('cust_')) {
      customerId = customerId.replace('cust_', '');
    }

    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id), 0) as total_conversations,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id AND status IN ('open', 'pending')), 0) as open_conversations
      FROM customers c
      WHERE c.id = $1 OR c.id::text = $2
    `, [parseInt(customerId) || 0, customerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json({
      success: true,
      data: mapCustomerRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[Customers] Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// POST /api/customers - Create new customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { email, phone, name, company, tier, metadata } = req.body;

    const result = await pool.query(`
      INSERT INTO customers (email, phone, name, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [
      email || null,
      phone || null,
      name || 'Unknown Customer',
      JSON.stringify({
        company: company || null,
        tier: tier || 'standard',
        ...metadata
      })
    ]);

    res.status(201).json({
      success: true,
      data: mapCustomerRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[Customers] Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: error.message }
    });
  }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    let customerId = req.params.id;

    if (customerId.startsWith('cust_')) {
      customerId = customerId.replace('cust_', '');
    }

    const { email, phone, name, company, tier, metadata } = req.body;

    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (email !== undefined) { sets.push(`email = $${paramIndex++}`); values.push(email); }
    if (phone !== undefined) { sets.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (name !== undefined) { sets.push(`name = $${paramIndex++}`); values.push(name); }

    // Handle metadata updates
    if (company !== undefined || tier !== undefined || metadata !== undefined) {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paramIndex++}::jsonb`);
      values.push(JSON.stringify({
        ...(company !== undefined ? { company } : {}),
        ...(tier !== undefined ? { tier } : {}),
        ...metadata
      }));
    }

    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) {
      // Only updated_at, fetch and return current
      const result = await pool.query('SELECT * FROM customers WHERE id = $1 OR id::text = $2',
        [parseInt(customerId) || 0, customerId]);
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Customer not found' }
        });
      }
      return res.json({ success: true, data: mapCustomerRow(result.rows[0]) });
    }

    values.push(parseInt(customerId) || 0);
    values.push(customerId);

    const result = await pool.query(`
      UPDATE customers
      SET ${sets.join(', ')}
      WHERE id = $${paramIndex} OR id::text = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json({
      success: true,
      data: mapCustomerRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[Customers] Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/conversations - Get customer's conversations
router.get('/:id/conversations', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    let customerId = req.params.id;

    if (customerId.startsWith('cust_')) {
      customerId = customerId.replace('cust_', '');
    }

    const result = await pool.query(`
      SELECT
        'conv_' || id::text as id,
        'cust_' || customer_id::text as "customerId",
        channel,
        status,
        COALESCE(priority, 'normal') as priority,
        subject,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM conversations
      WHERE customer_id = $1 OR customer_id::text = $2
      ORDER BY updated_at DESC
    `, [parseInt(customerId) || 0, customerId]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: result.rows.length,
        totalPages: Math.ceil(result.rows.length / 20)
      }
    });
  } catch (error: any) {
    console.error('[Customers] Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// POST /api/customers/:id/merge - Merge two customers
router.post('/:id/merge', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    let primaryId = req.params.id;
    let { mergeCustomerId } = req.body;

    if (primaryId.startsWith('cust_')) primaryId = primaryId.replace('cust_', '');
    if (mergeCustomerId?.startsWith('cust_')) mergeCustomerId = mergeCustomerId.replace('cust_', '');

    // Get both customers
    const primaryResult = await pool.query('SELECT * FROM customers WHERE id = $1 OR id::text = $2',
      [parseInt(primaryId) || 0, primaryId]);
    const secondaryResult = await pool.query('SELECT * FROM customers WHERE id = $1 OR id::text = $2',
      [parseInt(mergeCustomerId) || 0, mergeCustomerId]);

    if (primaryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Primary customer not found' }
      });
    }

    if (secondaryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Secondary customer not found' }
      });
    }

    const primary = primaryResult.rows[0];
    const secondary = secondaryResult.rows[0];

    // Merge metadata
    const mergedMetadata = { ...secondary.metadata, ...primary.metadata };

    // Update primary customer with merged data
    await pool.query(`
      UPDATE customers SET
        email = COALESCE($1, email),
        phone = COALESCE($2, phone),
        metadata = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [
      primary.email || secondary.email,
      primary.phone || secondary.phone,
      JSON.stringify(mergedMetadata),
      primary.id
    ]);

    // Move conversations from secondary to primary
    await pool.query('UPDATE conversations SET customer_id = $1 WHERE customer_id = $2',
      [primary.id, secondary.id]);

    // Delete secondary customer
    await pool.query('DELETE FROM customers WHERE id = $1', [secondary.id]);

    // Fetch updated primary customer
    const updatedResult = await pool.query(`
      SELECT
        c.*,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id), 0) as total_conversations,
        COALESCE((SELECT COUNT(*) FROM conversations WHERE customer_id = c.id AND status IN ('open', 'pending')), 0) as open_conversations
      FROM customers c
      WHERE c.id = $1
    `, [primary.id]);

    res.json({
      success: true,
      data: mapCustomerRow(updatedResult.rows[0])
    });
  } catch (error: any) {
    console.error('[Customers] Error merging customers:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MERGE_ERROR', message: error.message }
    });
  }
});

// Helper function to map database row to frontend Customer format
function mapCustomerRow(row: any): any {
  const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});

  return {
    id: 'cust_' + row.id,
    name: row.name || 'Unknown',
    identityGraph: {
      emails: row.email ? [row.email] : [],
      phoneNumbers: row.phone ? [row.phone] : [],
      socialIds: {}
    },
    profile: {
      name: row.name || 'Unknown',
      company: metadata.company || null,
      title: metadata.title || null,
      location: metadata.location || null
    },
    slaTier: metadata.tier || 'standard',
    tags: metadata.tags || [],
    segments: metadata.segments || [],
    customFields: metadata.customFields || {},
    stats: {
      totalConversations: parseInt(row.total_conversations) || 0,
      openConversations: parseInt(row.open_conversations) || 0,
      avgResolutionTime: metadata.avgResolutionTime || 0,
      satisfaction: metadata.satisfaction || 0
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export default router;
