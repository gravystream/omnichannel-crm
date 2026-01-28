import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'omnichannel_crm',
      user: process.env.DB_USER || 'crm',
      password: process.env.DB_PASSWORD || 'CrmSecure2024!',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
    pool.on('error', (err: Error) => console.error('[Database] Pool error:', err));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.end(); pool = null; }
}

export async function initDatabase(): Promise<void> {
  const p = getPool();
  console.log('[Database] Initializing schema...');
  await p.query("CREATE TABLE IF NOT EXISTS resolutions (id VARCHAR(64) PRIMARY KEY, conversation_id VARCHAR(64), issue_type VARCHAR(64) NOT NULL, owning_team VARCHAR(64) NOT NULL, owner_id VARCHAR(64), status VARCHAR(32) DEFAULT 'investigating', priority VARCHAR(8) NOT NULL, title TEXT, description TEXT, root_cause TEXT, resolution TEXT, expected_resolution_at TIMESTAMP WITH TIME ZONE, actual_resolution_at TIMESTAMP WITH TIME ZONE, sla_breached BOOLEAN DEFAULT FALSE, metadata JSONB DEFAULT '{}', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
  await p.query("CREATE TABLE IF NOT EXISTS resolution_updates (id VARCHAR(64) PRIMARY KEY, resolution_id VARCHAR(64) REFERENCES resolutions(id) ON DELETE CASCADE, update_type VARCHAR(32) NOT NULL, content TEXT NOT NULL, visibility VARCHAR(16) DEFAULT 'internal', author_id VARCHAR(64) NOT NULL, author_source VARCHAR(16) DEFAULT 'app', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
  await p.query("CREATE TABLE IF NOT EXISTS swarms (id VARCHAR(64) PRIMARY KEY, resolution_id VARCHAR(64) REFERENCES resolutions(id) ON DELETE CASCADE, slack_channel_id VARCHAR(64) NOT NULL, slack_channel_name VARCHAR(128) NOT NULL, slack_channel_url TEXT, participants JSONB DEFAULT '[]', status VARCHAR(16) DEFAULT 'active', sync_enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), archived_at TIMESTAMP WITH TIME ZONE)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolutions_conversation ON resolutions(conversation_id)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolutions_status ON resolutions(status)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolution_updates_resolution ON resolution_updates(resolution_id)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_swarms_resolution ON swarms(resolution_id)");
  console.log('[Database] Schema initialized');
}

export default { getPool, closePool, initDatabase };
