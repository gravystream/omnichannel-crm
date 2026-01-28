import { getPool } from '../utils/database';

export interface Resolution {
  id: string;
  conversationId?: string;
  issueType: string;
  owningTeam: string;
  ownerId?: string;
  status: string;
  priority: string;
  title?: string;
  description?: string;
  rootCause?: string;
  resolution?: string;
  expectedResolutionAt?: Date;
  actualResolutionAt?: Date;
  slaBreached: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolutionUpdate {
  id: string;
  resolutionId: string;
  updateType: string;
  content: string;
  visibility: string;
  authorId: string;
  authorSource: string;
  createdAt: Date;
}

export interface CreateResolutionInput {
  conversationId?: string;
  issueType: string;
  owningTeam: string;
  ownerId?: string;
  priority: string;
  title?: string;
  description?: string;
  expectedResolutionAt?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateResolutionInput {
  status?: string;
  ownerId?: string;
  owningTeam?: string;
  priority?: string;
  title?: string;
  description?: string;
  rootCause?: string;
  resolution?: string;
  expectedResolutionAt?: Date;
  actualResolutionAt?: Date;
  slaBreached?: boolean;
  metadata?: Record<string, any>;
}

export interface FindResolutionsOptions {
  status?: string | string[];
  priority?: string | string[];
  owningTeam?: string;
  ownerId?: string;
  conversationId?: string;
  slaBreached?: boolean;
  page?: number;
  pageSize?: number;
}

function generateId(): string {
  return 'res_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export class ResolutionRepository {
  async create(input: CreateResolutionInput): Promise<Resolution> {
    const pool = getPool();
    const id = generateId();
    const now = new Date();
    const query = 'INSERT INTO resolutions (id, conversation_id, issue_type, owning_team, owner_id, status, priority, title, description, expected_resolution_at, sla_breached, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *';
    const values = [id, input.conversationId || null, input.issueType, input.owningTeam, input.ownerId || null, 'investigating', input.priority, input.title || null, input.description || null, input.expectedResolutionAt || null, false, JSON.stringify(input.metadata || {}), now, now];
    const result = await pool.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Resolution | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resolutions WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByConversationId(conversationId: string): Promise<Resolution | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resolutions WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1', [conversationId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, input: UpdateResolutionInput): Promise<Resolution | null> {
    const pool = getPool();
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (input.status !== undefined) { sets.push('status = $' + paramIndex++); values.push(input.status); }
    if (input.ownerId !== undefined) { sets.push('owner_id = $' + paramIndex++); values.push(input.ownerId); }
    if (input.owningTeam !== undefined) { sets.push('owning_team = $' + paramIndex++); values.push(input.owningTeam); }
    if (input.priority !== undefined) { sets.push('priority = $' + paramIndex++); values.push(input.priority); }
    if (input.title !== undefined) { sets.push('title = $' + paramIndex++); values.push(input.title); }
    if (input.description !== undefined) { sets.push('description = $' + paramIndex++); values.push(input.description); }
    if (input.rootCause !== undefined) { sets.push('root_cause = $' + paramIndex++); values.push(input.rootCause); }
    if (input.resolution !== undefined) { sets.push('resolution = $' + paramIndex++); values.push(input.resolution); }
    if (input.expectedResolutionAt !== undefined) { sets.push('expected_resolution_at = $' + paramIndex++); values.push(input.expectedResolutionAt); }
    if (input.actualResolutionAt !== undefined) { sets.push('actual_resolution_at = $' + paramIndex++); values.push(input.actualResolutionAt); }
    if (input.slaBreached !== undefined) { sets.push('sla_breached = $' + paramIndex++); values.push(input.slaBreached); }
    if (input.metadata !== undefined) { sets.push('metadata = $' + paramIndex++); values.push(JSON.stringify(input.metadata)); }
    if (sets.length === 0) return this.getById(id);
    sets.push('updated_at = $' + paramIndex++);
    values.push(new Date());
    values.push(id);
    const query = 'UPDATE resolutions SET ' + sets.join(', ') + ' WHERE id = $' + paramIndex + ' RETURNING *';
    const result = await pool.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async find(options: FindResolutionsOptions = {}): Promise<{ data: Resolution[]; total: number }> {
    const pool = getPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (options.status) { const statuses = Array.isArray(options.status) ? options.status : options.status.split(','); conditions.push('status = ANY($' + paramIndex++ + ')'); values.push(statuses); }
    if (options.priority) { const priorities = Array.isArray(options.priority) ? options.priority : options.priority.split(','); conditions.push('priority = ANY($' + paramIndex++ + ')'); values.push(priorities); }
    if (options.owningTeam) { conditions.push('owning_team = $' + paramIndex++); values.push(options.owningTeam); }
    if (options.ownerId) { conditions.push('owner_id = $' + paramIndex++); values.push(options.ownerId); }
    if (options.conversationId) { conditions.push('conversation_id = $' + paramIndex++); values.push(options.conversationId); }
    if (options.slaBreached !== undefined) { conditions.push('sla_breached = $' + paramIndex++); values.push(options.slaBreached); }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const countResult = await pool.query('SELECT COUNT(*) FROM resolutions ' + whereClause, values);
    const total = parseInt(countResult.rows[0].count, 10);
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const dataQuery = 'SELECT * FROM resolutions ' + whereClause + " ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, created_at DESC LIMIT $" + paramIndex++ + ' OFFSET $' + paramIndex;
    values.push(pageSize, offset);
    const dataResult = await pool.query(dataQuery, values);
    return { data: dataResult.rows.map((row: any) => this.mapRow(row)), total };
  }

  async addUpdate(resolutionId: string, updateType: string, content: string, authorId: string, visibility: string = 'internal', authorSource: string = 'app'): Promise<ResolutionUpdate> {
    const pool = getPool();
    const id = 'upd_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const query = 'INSERT INTO resolution_updates (id, resolution_id, update_type, content, visibility, author_id, author_source, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';
    const result = await pool.query(query, [id, resolutionId, updateType, content, visibility, authorId, authorSource, new Date()]);
    return this.mapUpdateRow(result.rows[0]);
  }

  async getUpdates(resolutionId: string): Promise<ResolutionUpdate[]> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resolution_updates WHERE resolution_id = $1 ORDER BY created_at ASC', [resolutionId]);
    return result.rows.map((row: any) => this.mapUpdateRow(row));
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM resolutions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): Resolution {
    return { id: row.id, conversationId: row.conversation_id, issueType: row.issue_type, owningTeam: row.owning_team, ownerId: row.owner_id, status: row.status, priority: row.priority, title: row.title, description: row.description, rootCause: row.root_cause, resolution: row.resolution, expectedResolutionAt: row.expected_resolution_at, actualResolutionAt: row.actual_resolution_at, slaBreached: row.sla_breached, metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {}, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapUpdateRow(row: any): ResolutionUpdate {
    return { id: row.id, resolutionId: row.resolution_id, updateType: row.update_type, content: row.content, visibility: row.visibility, authorId: row.author_id, authorSource: row.author_source, createdAt: row.created_at };
  }
}

export const resolutionRepository = new ResolutionRepository();
export default resolutionRepository;
