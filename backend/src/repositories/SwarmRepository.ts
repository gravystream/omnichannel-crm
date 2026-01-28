import { getPool } from '../utils/database';

export interface Swarm {
  id: string;
  resolutionId: string;
  slackChannelId: string;
  slackChannelName: string;
  slackChannelUrl?: string;
  participants: string[];
  status: string;
  syncEnabled: boolean;
  createdAt: Date;
  archivedAt?: Date;
}

export interface CreateSwarmInput {
  resolutionId: string;
  slackChannelId: string;
  slackChannelName: string;
  slackChannelUrl?: string;
}

function generateId(): string {
  return 'swarm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export class SwarmRepository {
  async create(input: CreateSwarmInput): Promise<Swarm> {
    const pool = getPool();
    const id = generateId();
    const query = 'INSERT INTO swarms (id, resolution_id, slack_channel_id, slack_channel_name, slack_channel_url, participants, status, sync_enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';
    const result = await pool.query(query, [id, input.resolutionId, input.slackChannelId, input.slackChannelName, input.slackChannelUrl || null, JSON.stringify([]), 'active', true, new Date()]);
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Swarm | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM swarms WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByResolution(resolutionId: string): Promise<Swarm | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM swarms WHERE resolution_id = $1 ORDER BY created_at DESC LIMIT 1', [resolutionId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getBySlackChannel(slackChannelId: string): Promise<Swarm | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM swarms WHERE slack_channel_id = $1', [slackChannelId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<Pick<Swarm, 'status' | 'syncEnabled' | 'archivedAt'>>): Promise<Swarm | null> {
    const pool = getPool();
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (updates.status !== undefined) { sets.push('status = $' + paramIndex++); values.push(updates.status); }
    if (updates.syncEnabled !== undefined) { sets.push('sync_enabled = $' + paramIndex++); values.push(updates.syncEnabled); }
    if (updates.archivedAt !== undefined) { sets.push('archived_at = $' + paramIndex++); values.push(updates.archivedAt); }
    if (sets.length === 0) return this.getById(id);
    values.push(id);
    const query = 'UPDATE swarms SET ' + sets.join(', ') + ' WHERE id = $' + paramIndex + ' RETURNING *';
    const result = await pool.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async addParticipant(id: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const swarm = await this.getById(id);
    if (!swarm) return false;
    if (!swarm.participants.includes(userId)) {
      swarm.participants.push(userId);
      await pool.query('UPDATE swarms SET participants = $1 WHERE id = $2', [JSON.stringify(swarm.participants), id]);
    }
    return true;
  }

  async removeParticipant(id: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const swarm = await this.getById(id);
    if (!swarm) return false;
    swarm.participants = swarm.participants.filter((p) => p !== userId);
    await pool.query('UPDATE swarms SET participants = $1 WHERE id = $2', [JSON.stringify(swarm.participants), id]);
    return true;
  }

  async getActive(): Promise<Swarm[]> {
    const pool = getPool();
    const result = await pool.query("SELECT * FROM swarms WHERE status = 'active' ORDER BY created_at DESC");
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM swarms WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): Swarm {
    return { id: row.id, resolutionId: row.resolution_id, slackChannelId: row.slack_channel_id, slackChannelName: row.slack_channel_name, slackChannelUrl: row.slack_channel_url, participants: typeof row.participants === 'string' ? JSON.parse(row.participants) : row.participants || [], status: row.status, syncEnabled: row.sync_enabled, createdAt: row.created_at, archivedAt: row.archived_at };
  }
}

export const swarmRepository = new SwarmRepository();
export default swarmRepository;
