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
      connectionTimeoutMillis: 30000,
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

  // Add metadata column to customers table if it doesn't exist
  await p.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'metadata') THEN
        ALTER TABLE customers ADD COLUMN metadata JSONB DEFAULT '{}';
      END IF;
    END $$;
  `);

  await p.query("CREATE TABLE IF NOT EXISTS resolutions (id VARCHAR(64) PRIMARY KEY, conversation_id VARCHAR(64), issue_type VARCHAR(64) NOT NULL, owning_team VARCHAR(64) NOT NULL, owner_id VARCHAR(64), status VARCHAR(32) DEFAULT 'investigating', priority VARCHAR(8) NOT NULL, title TEXT, description TEXT, root_cause TEXT, resolution TEXT, expected_resolution_at TIMESTAMP WITH TIME ZONE, actual_resolution_at TIMESTAMP WITH TIME ZONE, sla_breached BOOLEAN DEFAULT FALSE, metadata JSONB DEFAULT '{}', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
  await p.query("CREATE TABLE IF NOT EXISTS resolution_updates (id VARCHAR(64) PRIMARY KEY, resolution_id VARCHAR(64) REFERENCES resolutions(id) ON DELETE CASCADE, update_type VARCHAR(32) NOT NULL, content TEXT NOT NULL, visibility VARCHAR(16) DEFAULT 'internal', author_id VARCHAR(64) NOT NULL, author_source VARCHAR(16) DEFAULT 'app', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
  await p.query("CREATE TABLE IF NOT EXISTS swarms (id VARCHAR(64) PRIMARY KEY, resolution_id VARCHAR(64) REFERENCES resolutions(id) ON DELETE CASCADE, slack_channel_id VARCHAR(64) NOT NULL, slack_channel_name VARCHAR(128) NOT NULL, slack_channel_url TEXT, participants JSONB DEFAULT '[]', status VARCHAR(16) DEFAULT 'active', sync_enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), archived_at TIMESTAMP WITH TIME ZONE)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolutions_conversation ON resolutions(conversation_id)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolutions_status ON resolutions(status)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_resolution_updates_resolution ON resolution_updates(resolution_id)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_swarms_resolution ON swarms(resolution_id)");

  // Knowledge Base articles table
  await p.query(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category VARCHAR(64) DEFAULT 'general',
      tags JSONB DEFAULT '[]',
      status VARCHAR(32) DEFAULT 'draft',
      author VARCHAR(128),
      views INTEGER DEFAULT 0,
      helpful INTEGER DEFAULT 0,
      not_helpful INTEGER DEFAULT 0,
      exclude_from_ai BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await p.query("CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status)");

  // AI Configuration table
  await p.query(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id SERIAL PRIMARY KEY,
      key VARCHAR(128) UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // AI Agent assignments and actions log
  await p.query(`
    CREATE TABLE IF NOT EXISTS ai_actions (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER,
      action_type VARCHAR(64) NOT NULL,
      action_data JSONB DEFAULT '{}',
      result JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await p.query("CREATE INDEX IF NOT EXISTS idx_ai_actions_conversation ON ai_actions(conversation_id)");
  await p.query("CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions(action_type)");

  console.log('[Database] Schema initialized');
}

export default { getPool, closePool, initDatabase };
