# Database Schema Documentation

## Overview

This document defines the complete database schema for the Omnichannel CRM system using PostgreSQL with event sourcing patterns for audit compliance.

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Customer    │       │   Conversation  │       │    Resolution   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ customer_id(FK) │       │ id (PK)         │
│ identity_graph  │       │ id (PK)         │◄──────│conversation_id  │
│ profile         │       │ state           │       │ issue_type      │
│ sla_tier        │       │ current_channel │       │ owning_team     │
│ tags            │       │ assigned_agent  │       │ status          │
│ risk_flags      │       │ sla_data        │       │ eta_window      │
└─────────────────┘       └────────┬────────┘       │ sla_clock       │
                                   │                └─────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│     Message     │   │  InternalNote   │   │   Assignment    │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ id (PK)         │   │ id (PK)         │   │ id (PK)         │
│ conversation_id │   │ conversation_id │   │ conversation_id │
│ channel         │   │ author_id       │   │ agent_id        │
│ direction       │   │ content         │   │ assigned_at     │
│ content         │   │ visibility      │   │ unassigned_at   │
│ ai_annotations  │   └─────────────────┘   └─────────────────┘
│ attachments     │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Channel     │       │  AIAnnotation   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ email           │       │ type            │       │ message_id      │
│ role            │       │ config          │       │ intent          │
│ skills          │       │ status          │       │ severity        │
│ status          │       └─────────────────┘       │ sentiment       │
│ team_id         │                                 │ entities        │
└─────────────────┘                                 │ confidence      │
                                                    └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   EventLog      │       │ AutomationRule  │       │   Attachment    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ event_type      │       │ name            │       │ message_id      │
│ entity_type     │       │ trigger         │       │ filename        │
│ entity_id       │       │ conditions      │       │ content_type    │
│ payload         │       │ actions         │       │ storage_url     │
│ actor_id        │       │ priority        │       │ size_bytes      │
│ timestamp       │       │ enabled         │       └─────────────────┘
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      SLA        │       │  KnowledgeBase  │       │    Swarm        │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ tier            │       │ title           │       │ resolution_id   │
│ first_response  │       │ content         │       │ slack_channel   │
│ resolution_time │       │ category        │       │ participants    │
│ update_interval │       │ tags            │       │ status          │
└─────────────────┘       │ visibility      │       └─────────────────┘
                          └─────────────────┘
```

---

## Table Definitions

### 1. customers

Core customer identity and profile information.

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity Graph (JSONB for flexibility)
    identity_graph JSONB NOT NULL DEFAULT '{
        "emails": [],
        "phone_numbers": [],
        "social_ids": {},
        "device_fingerprints": []
    }',

    -- Profile Information
    profile JSONB NOT NULL DEFAULT '{
        "name": null,
        "company": null,
        "avatar_url": null,
        "metadata": {}
    }',

    -- Segmentation
    sla_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
        CHECK (sla_tier IN ('free', 'standard', 'premium', 'enterprise')),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    segments TEXT[] DEFAULT ARRAY[]::TEXT[],
    risk_flags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'blocked', 'merged')),
    merged_into_id UUID REFERENCES customers(id),

    -- Timestamps
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for identity resolution
CREATE INDEX idx_customers_emails ON customers USING GIN ((identity_graph->'emails'));
CREATE INDEX idx_customers_phones ON customers USING GIN ((identity_graph->'phone_numbers'));
CREATE INDEX idx_customers_social ON customers USING GIN ((identity_graph->'social_ids'));
CREATE INDEX idx_customers_tags ON customers USING GIN (tags);
CREATE INDEX idx_customers_segments ON customers USING GIN (segments);
CREATE INDEX idx_customers_sla_tier ON customers(sla_tier);
CREATE INDEX idx_customers_status ON customers(status);
```

### 2. conversations

The heart of the system - unified conversation timeline.

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Customer Link
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- State Machine
    state VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (state IN (
            'open',
            'awaiting_customer',
            'awaiting_agent',
            'escalated',
            'resolved',
            'reopened'
        )),
    previous_state VARCHAR(30),

    -- Channel Information
    channels_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    current_channel VARCHAR(30),
    initial_channel VARCHAR(30) NOT NULL,

    -- Assignment
    assigned_agent_id UUID REFERENCES users(id),
    assigned_team_id UUID REFERENCES teams(id),

    -- Classification (from AI)
    intent VARCHAR(50),
    severity VARCHAR(10) CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'angry')),
    required_skills TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- SLA Tracking
    sla_tier VARCHAR(20) NOT NULL DEFAULT 'standard',
    first_response_at TIMESTAMPTZ,
    first_response_due_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,

    -- Linked Resolution (for escalated issues)
    resolution_id UUID,

    -- Metadata
    subject VARCHAR(500),
    summary TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}',

    -- Message Counts (denormalized for performance)
    message_count INTEGER DEFAULT 0,
    internal_note_count INTEGER DEFAULT 0,

    -- Timestamps
    last_message_at TIMESTAMPTZ,
    last_customer_message_at TIMESTAMPTZ,
    last_agent_message_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    reopened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_state ON conversations(state);
CREATE INDEX idx_conversations_assigned_agent ON conversations(assigned_agent_id);
CREATE INDEX idx_conversations_assigned_team ON conversations(assigned_team_id);
CREATE INDEX idx_conversations_severity ON conversations(severity);
CREATE INDEX idx_conversations_sla_due ON conversations(first_response_due_at) WHERE state IN ('open', 'awaiting_agent');
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN (tags);
```

### 3. messages

Individual messages within conversations.

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation Link
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Message Details
    channel VARCHAR(30) NOT NULL CHECK (channel IN (
        'web_chat', 'email', 'whatsapp', 'facebook',
        'instagram', 'twitter', 'voice', 'sms', 'internal'
    )),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),

    -- Sender Information
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'ai')),
    sender_id UUID, -- NULL for customer messages

    -- Content
    content_type VARCHAR(30) DEFAULT 'text' CHECK (content_type IN (
        'text', 'html', 'markdown', 'voice_transcript', 'system_event'
    )),
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered HTML for rich content

    -- Voice-specific
    voice_recording_url TEXT,
    voice_duration_seconds INTEGER,

    -- Channel-specific metadata
    channel_message_id VARCHAR(255), -- External message ID
    channel_metadata JSONB DEFAULT '{}',

    -- Threading (for email)
    parent_message_id UUID REFERENCES messages(id),
    thread_id UUID,

    -- AI Processing
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_annotations JSONB DEFAULT '{}',

    -- Status
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'failed'
    )),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_ai_processed ON messages(ai_processed) WHERE ai_processed = FALSE;

-- Full-text search
CREATE INDEX idx_messages_content_fts ON messages USING GIN (to_tsvector('english', content));
```

### 4. attachments

Files attached to messages.

```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message Link
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

    -- File Information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,

    -- Storage
    storage_provider VARCHAR(50) DEFAULT 'local' CHECK (storage_provider IN ('local', 's3', 'minio', 'gcs')),
    storage_url TEXT NOT NULL,
    storage_key TEXT NOT NULL,

    -- Image Processing
    is_image BOOLEAN DEFAULT FALSE,
    thumbnail_url TEXT,
    dimensions JSONB, -- {"width": 1920, "height": 1080}

    -- Security
    virus_scanned BOOLEAN DEFAULT FALSE,
    virus_scan_result VARCHAR(20),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- For temporary files
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_content_type ON attachments(content_type);
```

### 5. ai_annotations

AI-generated annotations for messages.

```sql
CREATE TABLE ai_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message Link
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

    -- Classification Results
    intent VARCHAR(50) NOT NULL CHECK (intent IN (
        'how_to_guidance',
        'account_access_issue',
        'transaction_system_failure',
        'bug_technical_defect',
        'urgent_high_risk',
        'noise_low_intent',
        'unknown'
    )),
    intent_confidence DECIMAL(3,2) NOT NULL CHECK (intent_confidence >= 0 AND intent_confidence <= 1),

    -- Severity
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
    severity_confidence DECIMAL(3,2) NOT NULL,

    -- Sentiment
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'angry')),
    sentiment_score DECIMAL(4,3), -- -1 to 1

    -- Entity Extraction
    entities JSONB DEFAULT '{}', -- {"transaction_ids": [], "error_codes": [], "product_names": []}

    -- Analysis
    suspected_root_cause TEXT,
    suggested_action TEXT,
    suggested_response TEXT,
    suggested_kb_articles UUID[],

    -- Routing Suggestions
    suggested_skills TEXT[],
    suggested_team_id UUID REFERENCES teams(id),
    escalation_recommended BOOLEAN DEFAULT FALSE,

    -- Model Information
    model_version VARCHAR(50) NOT NULL,
    processing_time_ms INTEGER,

    -- Human Override
    human_corrected BOOLEAN DEFAULT FALSE,
    corrected_by_id UUID REFERENCES users(id),
    corrected_at TIMESTAMPTZ,
    correction_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_annotations_message ON ai_annotations(message_id);
CREATE INDEX idx_ai_annotations_intent ON ai_annotations(intent);
CREATE INDEX idx_ai_annotations_severity ON ai_annotations(severity);
CREATE INDEX idx_ai_annotations_human_corrected ON ai_annotations(human_corrected);
```

### 6. resolutions

Long-running issue tracking.

```sql
CREATE TABLE resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation Link
    conversation_id UUID NOT NULL REFERENCES conversations(id),

    -- Issue Classification
    issue_type VARCHAR(30) NOT NULL CHECK (issue_type IN (
        'technical', 'billing', 'ops', 'compliance', 'security', 'other'
    )),
    issue_subtype VARCHAR(50),

    -- Ownership
    owning_team VARCHAR(30) NOT NULL CHECK (owning_team IN (
        'engineering', 'infra', 'finance', 'support', 'security', 'product'
    )),
    owner_id UUID REFERENCES users(id),

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'investigating' CHECK (status IN (
        'investigating',
        'awaiting_fix',
        'fix_in_progress',
        'awaiting_deploy',
        'deployed',
        'monitoring',
        'resolved',
        'wont_fix',
        'duplicate'
    )),

    -- ETA Management
    expected_resolution_at TIMESTAMPTZ,
    eta_window_hours INTEGER,
    eta_updated_at TIMESTAMPTZ,
    eta_update_reason TEXT,

    -- SLA Clock
    sla_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sla_paused_at TIMESTAMPTZ,
    sla_total_paused_seconds INTEGER DEFAULT 0,
    sla_breached BOOLEAN DEFAULT FALSE,

    -- Priority
    priority VARCHAR(10) NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),

    -- Root Cause Analysis
    root_cause TEXT,
    root_cause_category VARCHAR(50),
    affected_systems TEXT[],

    -- Fix Information
    fix_description TEXT,
    fix_commit_url TEXT,
    fix_deployed_at TIMESTAMPTZ,

    -- Recurrence Tracking
    is_recurrence BOOLEAN DEFAULT FALSE,
    parent_resolution_id UUID REFERENCES resolutions(id),
    recurrence_count INTEGER DEFAULT 0,

    -- Metadata
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key for conversation
ALTER TABLE conversations ADD CONSTRAINT fk_conversation_resolution
    FOREIGN KEY (resolution_id) REFERENCES resolutions(id);

CREATE INDEX idx_resolutions_conversation ON resolutions(conversation_id);
CREATE INDEX idx_resolutions_status ON resolutions(status);
CREATE INDEX idx_resolutions_owning_team ON resolutions(owning_team);
CREATE INDEX idx_resolutions_priority ON resolutions(priority);
CREATE INDEX idx_resolutions_created ON resolutions(created_at DESC);
```

### 7. resolution_updates

Updates within a resolution.

```sql
CREATE TABLE resolution_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Resolution Link
    resolution_id UUID NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,

    -- Update Details
    update_type VARCHAR(30) NOT NULL CHECK (update_type IN (
        'status_change',
        'note',
        'customer_update',
        'eta_change',
        'assignment_change',
        'priority_change',
        'fix_deployed',
        'root_cause_identified'
    )),

    -- Content
    content TEXT NOT NULL,
    visibility VARCHAR(20) DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer')),

    -- For status changes
    previous_status VARCHAR(30),
    new_status VARCHAR(30),

    -- Author
    author_id UUID NOT NULL REFERENCES users(id),
    author_source VARCHAR(20) DEFAULT 'app' CHECK (author_source IN ('app', 'slack', 'api', 'automation')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resolution_updates_resolution ON resolution_updates(resolution_id);
CREATE INDEX idx_resolution_updates_type ON resolution_updates(update_type);
CREATE INDEX idx_resolution_updates_visibility ON resolution_updates(visibility);
```

### 8. swarms

Slack swarm integration for resolution management.

```sql
CREATE TABLE swarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Resolution Link
    resolution_id UUID NOT NULL REFERENCES resolutions(id) UNIQUE,

    -- Slack Integration
    slack_channel_id VARCHAR(50) NOT NULL,
    slack_channel_name VARCHAR(100) NOT NULL,
    slack_channel_url TEXT,

    -- Participants
    participants JSONB DEFAULT '[]', -- [{"user_id": "...", "slack_id": "...", "role": "lead"}]
    lead_id UUID REFERENCES users(id),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),

    -- Sync State
    last_synced_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_swarms_resolution ON swarms(resolution_id);
CREATE INDEX idx_swarms_slack_channel ON swarms(slack_channel_id);
CREATE INDEX idx_swarms_status ON swarms(status);
```

### 9. users

System users (agents, admins, engineers).

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL for SSO users
    auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google', 'okta', 'saml')),
    auth_provider_id VARCHAR(255),

    -- Profile
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en',

    -- Role & Permissions
    role VARCHAR(30) NOT NULL DEFAULT 'agent' CHECK (role IN (
        'admin', 'supervisor', 'agent', 'engineer', 'api'
    )),
    permissions JSONB DEFAULT '[]',

    -- Team Assignment
    team_id UUID REFERENCES teams(id),

    -- Skills (for routing)
    skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    skill_levels JSONB DEFAULT '{}', -- {"billing": "expert", "technical": "intermediate"}

    -- Availability
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN (
        'available', 'busy', 'away', 'offline', 'do_not_disturb'
    )),
    max_concurrent_conversations INTEGER DEFAULT 5,
    current_conversation_count INTEGER DEFAULT 0,

    -- Slack Integration
    slack_user_id VARCHAR(50),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_active_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_skills ON users USING GIN (skills);
CREATE INDEX idx_users_slack ON users(slack_user_id);
```

### 10. teams

Team organization.

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Team Details
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Routing Configuration
    default_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    routing_mode VARCHAR(20) DEFAULT 'round_robin' CHECK (routing_mode IN (
        'round_robin', 'least_busy', 'skill_based', 'manual'
    )),

    -- SLA Override
    sla_override_id UUID REFERENCES slas(id),

    -- Escalation
    escalation_team_id UUID REFERENCES teams(id),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_name ON teams(name);
CREATE INDEX idx_teams_active ON teams(is_active);
```

### 11. internal_notes

Private notes on conversations.

```sql
CREATE TABLE internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE,

    -- Note Content
    content TEXT NOT NULL,

    -- Visibility
    visibility VARCHAR(20) DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'all')),

    -- Author
    author_id UUID NOT NULL REFERENCES users(id),

    -- Mentions
    mentions UUID[] DEFAULT ARRAY[]::UUID[],

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure at least one link
    CONSTRAINT chk_note_link CHECK (conversation_id IS NOT NULL OR resolution_id IS NOT NULL)
);

CREATE INDEX idx_internal_notes_conversation ON internal_notes(conversation_id);
CREATE INDEX idx_internal_notes_resolution ON internal_notes(resolution_id);
CREATE INDEX idx_internal_notes_author ON internal_notes(author_id);
```

### 12. assignments

Assignment history for audit.

```sql
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation Link
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Assignment Details
    agent_id UUID NOT NULL REFERENCES users(id),
    team_id UUID REFERENCES teams(id),

    -- Assignment Reason
    assigned_by VARCHAR(30) NOT NULL CHECK (assigned_by IN (
        'routing_engine', 'manual', 'escalation', 'transfer', 'reopen'
    )),
    assigned_by_user_id UUID REFERENCES users(id),
    reason TEXT,

    -- Timing
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    unassignment_reason VARCHAR(50)
);

CREATE INDEX idx_assignments_conversation ON assignments(conversation_id);
CREATE INDEX idx_assignments_agent ON assignments(agent_id);
CREATE INDEX idx_assignments_active ON assignments(assigned_at) WHERE unassigned_at IS NULL;
```

### 13. slas

SLA configuration.

```sql
CREATE TABLE slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- SLA Details
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'standard', 'premium', 'enterprise')),

    -- Response Times (in minutes)
    first_response_time_minutes INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,
    update_interval_minutes INTEGER NOT NULL DEFAULT 720, -- 12 hours default

    -- By Channel (overrides)
    channel_overrides JSONB DEFAULT '{}',
    -- {"web_chat": {"first_response": 5}, "email": {"first_response": 60}}

    -- By Priority (overrides)
    priority_overrides JSONB DEFAULT '{}',
    -- {"P0": {"first_response": 5, "resolution": 60}}

    -- Business Hours
    business_hours_only BOOLEAN DEFAULT TRUE,
    business_hours JSONB DEFAULT '{
        "monday": {"start": "09:00", "end": "17:00"},
        "tuesday": {"start": "09:00", "end": "17:00"},
        "wednesday": {"start": "09:00", "end": "17:00"},
        "thursday": {"start": "09:00", "end": "17:00"},
        "friday": {"start": "09:00", "end": "17:00"}
    }',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slas_tier ON slas(tier);
CREATE INDEX idx_slas_default ON slas(is_default) WHERE is_default = TRUE;
```

### 14. channels

Channel configuration.

```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Channel Details
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'web_chat', 'email', 'whatsapp', 'facebook',
        'instagram', 'twitter', 'voice', 'sms'
    )),
    name VARCHAR(100) NOT NULL,

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- email: {"imap_host": "...", "smtp_host": "...", "from_address": "..."}
    -- whatsapp: {"phone_number_id": "...", "access_token": "..."}

    -- Credentials (encrypted)
    credentials_encrypted TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_error TEXT,
    last_error_at TIMESTAMPTZ,

    -- Routing
    default_team_id UUID REFERENCES teams(id),
    default_skills TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_status ON channels(status);
```

### 15. automation_rules

Event-driven automation.

```sql
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Rule Details
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Trigger
    trigger_event VARCHAR(50) NOT NULL CHECK (trigger_event IN (
        'message.received',
        'conversation.created',
        'conversation.state_changed',
        'conversation.assigned',
        'resolution.created',
        'resolution.status_changed',
        'sla.warning',
        'sla.breached',
        'customer.updated'
    )),

    -- Conditions (all must match)
    conditions JSONB NOT NULL DEFAULT '[]',
    -- [{"field": "severity", "operator": "equals", "value": "P0"}]

    -- Actions (executed in order)
    actions JSONB NOT NULL DEFAULT '[]',
    -- [{"type": "send_message", "template": "..."}, {"type": "assign_team", "team_id": "..."}]

    -- Execution
    priority INTEGER DEFAULT 100, -- Lower = higher priority
    stop_processing BOOLEAN DEFAULT FALSE, -- Stop further rules

    -- Cooldown (prevent spam)
    cooldown_seconds INTEGER DEFAULT 0,
    cooldown_key VARCHAR(50), -- Field to use for cooldown grouping

    -- Status
    enabled BOOLEAN DEFAULT TRUE,

    -- Audit
    created_by_id UUID REFERENCES users(id),
    updated_by_id UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_event);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);
CREATE INDEX idx_automation_rules_priority ON automation_rules(priority);
```

### 16. knowledge_base_articles

Knowledge base for AI and agents.

```sql
CREATE TABLE knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Article Details
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,

    -- Content
    content TEXT NOT NULL,
    content_html TEXT,
    summary TEXT,

    -- Organization
    category_id UUID REFERENCES knowledge_base_categories(id),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- AI Training
    intent_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    exclude_from_ai BOOLEAN DEFAULT FALSE,

    -- Visibility
    visibility VARCHAR(20) DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'both')),

    -- Usage Stats
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    ai_suggestion_count INTEGER DEFAULT 0,
    ai_success_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

    -- Audit
    author_id UUID REFERENCES users(id),
    last_updated_by_id UUID REFERENCES users(id),

    -- Timestamps
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE knowledge_base_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    parent_id UUID REFERENCES knowledge_base_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_articles_category ON knowledge_base_articles(category_id);
CREATE INDEX idx_kb_articles_status ON knowledge_base_articles(status);
CREATE INDEX idx_kb_articles_visibility ON knowledge_base_articles(visibility);
CREATE INDEX idx_kb_articles_tags ON knowledge_base_articles USING GIN (tags);
CREATE INDEX idx_kb_articles_keywords ON knowledge_base_articles USING GIN (intent_keywords);
CREATE INDEX idx_kb_articles_content_fts ON knowledge_base_articles USING GIN (to_tsvector('english', title || ' ' || content));
```

### 17. event_log

Append-only audit log.

```sql
CREATE TABLE event_log (
    id BIGSERIAL PRIMARY KEY,

    -- Event Details
    event_type VARCHAR(50) NOT NULL,
    event_version INTEGER DEFAULT 1,

    -- Entity Reference
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    -- Payload (immutable snapshot)
    payload JSONB NOT NULL,

    -- Actor
    actor_type VARCHAR(20) CHECK (actor_type IN ('user', 'system', 'ai', 'automation', 'api')),
    actor_id UUID,
    actor_ip INET,
    actor_user_agent TEXT,

    -- Context
    conversation_id UUID,
    customer_id UUID,
    resolution_id UUID,

    -- Correlation
    correlation_id UUID,
    causation_id BIGINT REFERENCES event_log(id),

    -- Timestamp (immutable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance
-- CREATE TABLE event_log_y2024m01 PARTITION OF event_log
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_event_log_entity ON event_log(entity_type, entity_id);
CREATE INDEX idx_event_log_type ON event_log(event_type);
CREATE INDEX idx_event_log_created ON event_log(created_at DESC);
CREATE INDEX idx_event_log_conversation ON event_log(conversation_id);
CREATE INDEX idx_event_log_customer ON event_log(customer_id);
CREATE INDEX idx_event_log_correlation ON event_log(correlation_id);
```

### 18. customer_updates

Proactive updates sent to customers.

```sql
CREATE TABLE customer_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    resolution_id UUID NOT NULL REFERENCES resolutions(id),
    conversation_id UUID NOT NULL REFERENCES conversations(id),

    -- Update Details
    update_type VARCHAR(30) NOT NULL CHECK (update_type IN (
        'acknowledgement',
        'status_update',
        'eta_update',
        'resolution_summary',
        'scheduled_update'
    )),

    -- Content
    content TEXT NOT NULL,

    -- Delivery
    channel VARCHAR(30) NOT NULL,
    message_id UUID REFERENCES messages(id),

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_message TEXT,

    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_updates_resolution ON customer_updates(resolution_id);
CREATE INDEX idx_customer_updates_conversation ON customer_updates(conversation_id);
CREATE INDEX idx_customer_updates_scheduled ON customer_updates(scheduled_for) WHERE status = 'pending';
```

---

## Database Functions & Triggers

### Auto-update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ... (similar for other tables)
```

### Message count denormalization

```sql
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations
        SET message_count = message_count + 1,
            last_message_at = NEW.created_at
        WHERE id = NEW.conversation_id;

        IF NEW.direction = 'inbound' AND NEW.sender_type = 'customer' THEN
            UPDATE conversations
            SET last_customer_message_at = NEW.created_at
            WHERE id = NEW.conversation_id;
        ELSIF NEW.direction = 'outbound' AND NEW.sender_type = 'agent' THEN
            UPDATE conversations
            SET last_agent_message_at = NEW.created_at
            WHERE id = NEW.conversation_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_message_count
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();
```

### Event logging

```sql
CREATE OR REPLACE FUNCTION log_conversation_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.state IS DISTINCT FROM NEW.state THEN
        INSERT INTO event_log (event_type, entity_type, entity_id, payload, conversation_id, customer_id)
        VALUES (
            'conversation.state_changed',
            'conversation',
            NEW.id,
            jsonb_build_object(
                'previous_state', OLD.state,
                'new_state', NEW.state,
                'timestamp', NOW()
            ),
            NEW.id,
            NEW.customer_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_conversation_state
    AFTER UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION log_conversation_state_change();
```

---

## Views

### Active conversations queue

```sql
CREATE VIEW v_agent_queue AS
SELECT
    c.id,
    c.customer_id,
    c.state,
    c.severity,
    c.current_channel,
    c.first_response_due_at,
    c.resolution_due_at,
    c.assigned_agent_id,
    c.assigned_team_id,
    cu.profile->>'name' as customer_name,
    c.last_message_at,
    c.message_count,
    CASE
        WHEN c.first_response_at IS NULL AND c.first_response_due_at < NOW() THEN TRUE
        WHEN c.resolution_due_at < NOW() THEN TRUE
        ELSE FALSE
    END as sla_breached,
    GREATEST(
        EXTRACT(EPOCH FROM (NOW() - c.first_response_due_at)),
        EXTRACT(EPOCH FROM (NOW() - c.resolution_due_at))
    ) as urgency_score
FROM conversations c
JOIN customers cu ON c.customer_id = cu.id
WHERE c.state IN ('open', 'awaiting_agent', 'escalated', 'reopened')
ORDER BY
    CASE c.severity
        WHEN 'P0' THEN 1
        WHEN 'P1' THEN 2
        WHEN 'P2' THEN 3
        ELSE 4
    END,
    urgency_score DESC;
```

### Resolution dashboard

```sql
CREATE VIEW v_resolution_dashboard AS
SELECT
    r.id,
    r.conversation_id,
    r.issue_type,
    r.owning_team,
    r.status,
    r.priority,
    r.expected_resolution_at,
    r.sla_breached,
    r.created_at,
    EXTRACT(EPOCH FROM (NOW() - r.created_at))/3600 as age_hours,
    s.slack_channel_name as swarm_channel,
    u.display_name as owner_name,
    c.profile->>'name' as customer_name
FROM resolutions r
LEFT JOIN swarms s ON r.id = s.resolution_id
LEFT JOIN users u ON r.owner_id = u.id
JOIN conversations conv ON r.conversation_id = conv.id
JOIN customers c ON conv.customer_id = c.id
WHERE r.status NOT IN ('resolved', 'wont_fix', 'duplicate');
```

---

## Indexes Summary

All critical query paths are indexed:
- Customer identity resolution (GIN indexes on JSONB arrays)
- Conversation queue (state, assigned_agent, severity, SLA due dates)
- Message retrieval (conversation_id, created_at)
- Full-text search (GIN indexes on content)
- Event log queries (entity_type, entity_id, created_at)

---

## Migration Strategy

1. **Version Control**: All migrations in `/migrations` folder
2. **Naming**: `YYYYMMDD_HHMMSS_description.sql`
3. **Tool**: Use Flyway, golang-migrate, or node-pg-migrate
4. **Rollback**: Every migration must have a down script

```sql
-- Example migration: 20240115_100000_create_customers.sql

-- Up
CREATE TABLE customers (...);
CREATE INDEX ...;

-- Down
DROP TABLE IF EXISTS customers CASCADE;
```
