/**
 * Knowledge Base Routes - PostgreSQL Connected
 * Manages help articles, documentation, and AI training content
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../utils/database';

const router = Router();

// =============================================================================
// ARTICLES CRUD
// =============================================================================

// GET /api/knowledge-base/articles - List all articles
router.get('/articles', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { search, category, status, tags, page = '1', pageSize = '20' } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await pool.query(`SELECT COUNT(*) FROM kb_articles ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * size;

    const dataQuery = `
      SELECT * FROM kb_articles
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(size, offset);

    const result = await pool.query(dataQuery, values);

    res.json({
      success: true,
      data: result.rows.map(mapArticleRow),
      pagination: {
        page: pageNum,
        pageSize: size,
        totalItems: total,
        totalPages: Math.ceil(total / size)
      }
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error fetching articles:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// GET /api/knowledge-base/articles/:id - Get single article
router.get('/articles/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const articleId = req.params.id.replace('kb_', '');

    const result = await pool.query(
      'SELECT * FROM kb_articles WHERE id = $1 OR id::text = $2',
      [parseInt(articleId) || 0, articleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Article not found' }
      });
    }

    // Increment view count
    await pool.query(
      'UPDATE kb_articles SET views = views + 1 WHERE id = $1',
      [result.rows[0].id]
    );

    res.json({
      success: true,
      data: mapArticleRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error fetching article:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// POST /api/knowledge-base/articles - Create article
router.post('/articles', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { title, content, category, tags, status, author, summary, excludeFromAi } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title and content are required' }
      });
    }

    const result = await pool.query(`
      INSERT INTO kb_articles (title, content, summary, category, tags, status, author, exclude_from_ai, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      title,
      content,
      summary || content.substring(0, 200),
      category || 'general',
      JSON.stringify(tags || []),
      status || 'draft',
      author || 'Unknown',
      excludeFromAi || false
    ]);

    res.status(201).json({
      success: true,
      data: mapArticleRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error creating article:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: error.message }
    });
  }
});

// PUT /api/knowledge-base/articles/:id - Update article
router.put('/articles/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const articleId = req.params.id.replace('kb_', '');
    const { title, content, category, tags, status, summary, excludeFromAi } = req.body;

    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) { sets.push(`title = $${paramIndex++}`); values.push(title); }
    if (content !== undefined) { sets.push(`content = $${paramIndex++}`); values.push(content); }
    if (summary !== undefined) { sets.push(`summary = $${paramIndex++}`); values.push(summary); }
    if (category !== undefined) { sets.push(`category = $${paramIndex++}`); values.push(category); }
    if (tags !== undefined) { sets.push(`tags = $${paramIndex++}`); values.push(JSON.stringify(tags)); }
    if (status !== undefined) { sets.push(`status = $${paramIndex++}`); values.push(status); }
    if (excludeFromAi !== undefined) { sets.push(`exclude_from_ai = $${paramIndex++}`); values.push(excludeFromAi); }

    sets.push(`updated_at = NOW()`);

    values.push(parseInt(articleId) || 0);
    values.push(articleId);

    const result = await pool.query(`
      UPDATE kb_articles
      SET ${sets.join(', ')}
      WHERE id = $${paramIndex} OR id::text = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Article not found' }
      });
    }

    res.json({
      success: true,
      data: mapArticleRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error updating article:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: error.message }
    });
  }
});

// DELETE /api/knowledge-base/articles/:id - Delete article
router.delete('/articles/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const articleId = req.params.id.replace('kb_', '');

    const result = await pool.query(
      'DELETE FROM kb_articles WHERE id = $1 OR id::text = $2 RETURNING id',
      [parseInt(articleId) || 0, articleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Article not found' }
      });
    }

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error deleting article:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: error.message }
    });
  }
});

// POST /api/knowledge-base/articles/:id/helpful - Mark article as helpful/not helpful
router.post('/articles/:id/helpful', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const articleId = req.params.id.replace('kb_', '');
    const { helpful } = req.body;

    const column = helpful ? 'helpful' : 'not_helpful';

    const result = await pool.query(`
      UPDATE kb_articles
      SET ${column} = ${column} + 1, updated_at = NOW()
      WHERE id = $1 OR id::text = $2
      RETURNING *
    `, [parseInt(articleId) || 0, articleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Article not found' }
      });
    }

    res.json({
      success: true,
      data: mapArticleRow(result.rows[0])
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error updating helpful count:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// CATEGORIES
// =============================================================================

// GET /api/knowledge-base/categories - Get all categories with counts
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'published') as published_count
      FROM kb_articles
      GROUP BY category
      ORDER BY count DESC
    `);

    // Include default categories even if empty
    const defaultCategories = [
      { id: 'getting-started', name: 'Getting Started' },
      { id: 'billing', name: 'Billing & Payments' },
      { id: 'technical', name: 'Technical Support' },
      { id: 'account', name: 'Account Management' },
      { id: 'integrations', name: 'Integrations' },
      { id: 'api', name: 'API Documentation' },
      { id: 'general', name: 'General' }
    ];

    const categoryCounts = new Map(result.rows.map(r => [r.category, parseInt(r.count)]));

    const categories = defaultCategories.map(cat => ({
      ...cat,
      count: categoryCounts.get(cat.id) || 0
    }));

    res.json({
      success: true,
      data: categories
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// SEARCH (for AI integration)
// =============================================================================

// GET /api/knowledge-base/search - Search articles for AI deflection
router.get('/search', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { q, limit = '5', visibility } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Search query (q) is required' }
      });
    }

    const conditions = ["status = 'published'", "exclude_from_ai = false"];
    const values: any[] = [];
    let paramIndex = 1;

    // Full-text search with ranking
    conditions.push(`(
      title ILIKE $${paramIndex} OR
      content ILIKE $${paramIndex} OR
      tags::text ILIKE $${paramIndex} OR
      summary ILIKE $${paramIndex}
    )`);
    values.push(`%${q}%`);
    paramIndex++;

    const result = await pool.query(`
      SELECT *,
        CASE
          WHEN title ILIKE $1 THEN 10
          WHEN summary ILIKE $1 THEN 5
          WHEN tags::text ILIKE $1 THEN 3
          ELSE 1
        END as relevance_score
      FROM kb_articles
      WHERE ${conditions.join(' AND ')}
      ORDER BY relevance_score DESC, views DESC
      LIMIT $${paramIndex}
    `, [...values, parseInt(limit as string) || 5]);

    res.json({
      success: true,
      data: result.rows.map(mapArticleRow)
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error searching articles:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// STATISTICS
// =============================================================================

// GET /api/knowledge-base/stats - Get KB statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_articles,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as drafts,
        COUNT(*) FILTER (WHERE status = 'archived') as archived,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(helpful), 0) as total_helpful,
        COALESCE(SUM(not_helpful), 0) as total_not_helpful
      FROM kb_articles
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalArticles: parseInt(stats.total_articles),
        published: parseInt(stats.published),
        drafts: parseInt(stats.drafts),
        archived: parseInt(stats.archived),
        totalViews: parseInt(stats.total_views),
        totalHelpful: parseInt(stats.total_helpful),
        totalNotHelpful: parseInt(stats.total_not_helpful),
        helpfulRate: stats.total_helpful > 0
          ? (parseInt(stats.total_helpful) / (parseInt(stats.total_helpful) + parseInt(stats.total_not_helpful)) * 100).toFixed(1)
          : 0
      }
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// BULK IMPORT
// =============================================================================

// POST /api/knowledge-base/import - Bulk import articles
router.post('/import', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { articles } = req.body;

    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Articles array is required' }
      });
    }

    const imported: any[] = [];

    for (const article of articles) {
      if (article.title && article.content) {
        const result = await pool.query(`
          INSERT INTO kb_articles (title, content, summary, category, tags, status, author, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING *
        `, [
          article.title,
          article.content,
          article.summary || article.content.substring(0, 200),
          article.category || 'general',
          JSON.stringify(article.tags || []),
          article.status || 'draft',
          article.author || 'Import'
        ]);
        imported.push(mapArticleRow(result.rows[0]));
      }
    }

    res.status(201).json({
      success: true,
      message: `Imported ${imported.length} articles`,
      data: imported
    });
  } catch (error: any) {
    console.error('[KnowledgeBase] Error importing articles:', error);
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_ERROR', message: error.message }
    });
  }
});

// Helper function to map database row to frontend format
function mapArticleRow(row: any): any {
  const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []);

  return {
    id: 'kb_' + row.id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    category: row.category,
    tags: tags,
    status: row.status,
    author: row.author,
    views: row.views || 0,
    helpful: row.helpful || 0,
    notHelpful: row.not_helpful || 0,
    excludeFromAi: row.exclude_from_ai || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export default router;
