/**
 * Knowledge Base Service - PostgreSQL Connected
 * Provides search and retrieval for AI deflection and agent assistance
 */

import { getPool } from '../utils/database';

export interface KBSearchOptions {
  visibility?: 'customer' | 'internal' | 'all';
  limit?: number;
  category?: string;
  excludeIds?: string[];
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  category: string;
  tags: string[];
  status: string;
  views: number;
  helpful: number;
  notHelpful: number;
  excludeFromAi: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeBaseService {
  /**
   * Search knowledge base articles for AI deflection
   * Returns relevant articles ranked by relevance score
   */
  async search(query: string, options: KBSearchOptions = {}): Promise<KnowledgeBaseArticle[]> {
    try {
      const pool = getPool();
      const { limit = 5, category, excludeIds = [] } = options;

      const conditions = ["status = 'published'", "exclude_from_ai = false"];
      const values: any[] = [];
      let paramIndex = 1;

      // Search in title, content, summary, and tags
      conditions.push(`(
        title ILIKE $${paramIndex} OR
        content ILIKE $${paramIndex} OR
        summary ILIKE $${paramIndex} OR
        tags::text ILIKE $${paramIndex}
      )`);
      values.push(`%${query}%`);
      paramIndex++;

      if (category) {
        conditions.push(`category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (excludeIds.length > 0) {
        conditions.push(`id::text NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`);
        values.push(...excludeIds.map(id => id.replace('kb_', '')));
        paramIndex += excludeIds.length;
      }

      // Calculate relevance score for ranking
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
        ORDER BY relevance_score DESC, views DESC, helpful DESC
        LIMIT $${paramIndex}
      `, [...values, limit]);

      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[KnowledgeBaseService] Search error:', error);
      return [];
    }
  }

  /**
   * Get a single article by ID
   */
  async getArticle(id: string): Promise<KnowledgeBaseArticle | null> {
    try {
      const pool = getPool();
      const articleId = id.replace('kb_', '');

      const result = await pool.query(
        'SELECT * FROM kb_articles WHERE id = $1 OR id::text = $2',
        [parseInt(articleId) || 0, articleId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRow(result.rows[0]);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetArticle error:', error);
      return null;
    }
  }

  /**
   * Get multiple articles by IDs
   */
  async getArticles(ids: string[]): Promise<KnowledgeBaseArticle[]> {
    try {
      if (ids.length === 0) return [];

      const pool = getPool();
      const cleanIds = ids.map(id => id.replace('kb_', ''));

      const result = await pool.query(`
        SELECT * FROM kb_articles
        WHERE id::text = ANY($1)
        ORDER BY views DESC
      `, [cleanIds]);

      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetArticles error:', error);
      return [];
    }
  }

  /**
   * Find articles by category
   */
  async getByCategory(category: string, limit: number = 10): Promise<KnowledgeBaseArticle[]> {
    try {
      const pool = getPool();

      const result = await pool.query(`
        SELECT * FROM kb_articles
        WHERE category = $1 AND status = 'published'
        ORDER BY views DESC, helpful DESC
        LIMIT $2
      `, [category, limit]);

      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetByCategory error:', error);
      return [];
    }
  }

  /**
   * Get top performing articles (for AI learning)
   */
  async getTopArticles(limit: number = 20): Promise<KnowledgeBaseArticle[]> {
    try {
      const pool = getPool();

      const result = await pool.query(`
        SELECT *,
          CASE WHEN (helpful + not_helpful) > 0
            THEN (helpful::float / (helpful + not_helpful))
            ELSE 0
          END as helpful_ratio
        FROM kb_articles
        WHERE status = 'published' AND exclude_from_ai = false
        ORDER BY helpful_ratio DESC, views DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetTopArticles error:', error);
      return [];
    }
  }

  /**
   * Get all published articles for AI context building
   */
  async getAllForAI(): Promise<KnowledgeBaseArticle[]> {
    try {
      const pool = getPool();

      const result = await pool.query(`
        SELECT * FROM kb_articles
        WHERE status = 'published' AND exclude_from_ai = false
        ORDER BY category, views DESC
      `);

      return result.rows.map(this.mapRow);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetAllForAI error:', error);
      return [];
    }
  }

  /**
   * Record that an article was used for deflection
   */
  async recordDeflectionUse(articleId: string, successful: boolean): Promise<void> {
    try {
      const pool = getPool();
      const cleanId = articleId.replace('kb_', '');

      const column = successful ? 'helpful' : 'not_helpful';

      await pool.query(`
        UPDATE kb_articles
        SET ${column} = ${column} + 1, updated_at = NOW()
        WHERE id = $1 OR id::text = $2
      `, [parseInt(cleanId) || 0, cleanId]);
    } catch (error) {
      console.error('[KnowledgeBaseService] RecordDeflectionUse error:', error);
    }
  }

  /**
   * Get article count for stats
   */
  async getArticleCount(): Promise<number> {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT COUNT(*) FROM kb_articles WHERE status = 'published'");
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[KnowledgeBaseService] GetArticleCount error:', error);
      return 0;
    }
  }

  private mapRow(row: any): KnowledgeBaseArticle {
    const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []);

    return {
      id: 'kb_' + row.id,
      title: row.title,
      content: row.content,
      summary: row.summary,
      category: row.category,
      tags: tags,
      status: row.status,
      views: row.views || 0,
      helpful: row.helpful || 0,
      notHelpful: row.not_helpful || 0,
      excludeFromAi: row.exclude_from_ai || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService;
