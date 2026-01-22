# Omnichannel CRM System Architecture

## System Overview

This document describes the architecture of a production-grade, self-hosted omnichannel Customer Care Management Platform with First-Contact AI Orchestrator and Resolution Orchestration System.

## Foundational Principles

1. **One Customer Identity** - Unified customer profile across all channels
2. **One Conversation Timeline** - Single continuous conversation, many channels
3. **Conversations Never End** - They change state, never disappear
4. **Humans are Scarce** - AI protects human capacity
5. **Engineers Fix Problems** - Agents manage trust
6. **Silence is Failure** - Proactive communication always

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CHANNEL LAYER                                       │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────────┤
│   Web    │  Email   │ WhatsApp │ Facebook │ Twitter  │  Voice   │  Instagram    │
│   Chat   │  SMTP    │   API    │Messenger │    DM    │   SIP    │     DM        │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴───────┬───────┘
     │          │          │          │          │          │             │
     ▼          ▼          ▼          ▼          ▼          ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      OMNICHANNEL INGESTION LAYER                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                    Channel Adapters (Normalization)                     │     │
│  │    WebSocket │ SMTP/IMAP │ WhatsApp │ FB │ Twitter │ Twilio │ IG       │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                    │                                             │
│                                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                    NormalizedMessage Pipeline                           │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FIRST-CONTACT AI ORCHESTRATOR                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  Intent Classification │ Severity Assessment │ Knowledge Deflection    │    │
│  │  Conversation Annotation │ Human Handoff │ Learning Loop               │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         FAILSAFE LAYER                                   │    │
│  │  Never block escalation │ Never fabricate │ Never override humans       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
┌──────────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────────┐
│   CONVERSATION ENGINE    │ │   ROUTING ENGINE    │ │ RESOLUTION ORCHESTRATION    │
│  ┌────────────────────┐  │ │ ┌─────────────────┐ │ │  ┌───────────────────────┐  │
│  │ Conversation Object│  │ │ │ Skill-Based     │ │ │  │ Resolution Object     │  │
│  │ - Messages         │  │ │ │ SLA-Aware       │ │ │  │ - Status Tracking     │  │
│  │ - Timeline         │  │ │ │ Availability    │ │ │  │ - Owning Team         │  │
│  │ - State Machine    │  │ │ │ Escalation      │ │ │  │ - ETA Windows         │  │
│  │ - AI Annotations   │  │ │ └─────────────────┘ │ │  │ - SLA Clock           │  │
│  │ - Audit Logs       │  │ │                     │ │  └───────────────────────┘  │
│  └────────────────────┘  │ │ ┌─────────────────┐ │ │  ┌───────────────────────┐  │
│                          │ │ │ Unified Inbox   │ │ │  │ Swarm Integration     │  │
│  ┌────────────────────┐  │ │ │ Assignment      │ │ │  │ - Slack Channels      │  │
│  │ Customer Profile   │  │ │ │ Queue Mgmt      │ │ │  │ - Bidirectional Sync  │  │
│  │ - Identity Graph   │  │ │ └─────────────────┘ │ │  │ - Engineer Updates    │  │
│  │ - Interaction Hist │  │ └─────────────────────┘ │  └───────────────────────┘  │
│  │ - SLA Tier         │  │                         │                             │
│  └────────────────────┘  │                         │  ┌───────────────────────┐  │
└──────────────────────────┘                         │  │ Customer Comms        │  │
                                                     │  │ - Acknowledgement     │  │
                                                     │  │ - Proactive Updates   │  │
                                                     │  │ - Resolution Summary  │  │
                                                     │  └───────────────────────┘  │
                                                     └─────────────────────────────┘
                    │                     │                     │
                    └─────────────────────┼─────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EVENT BUS (Kafka/Redis Streams)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ message.*   │ │conversation.│ │ resolution. │ │   sla.*     │ │ automation. ││
│  │             │ │      *      │ │      *      │ │             │ │      *      ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
│ AUTOMATION ENGINE    │   │ KNOWLEDGE BASE       │   │ ANALYTICS & AUDIT        │
│ ┌──────────────────┐ │   │ ┌──────────────────┐ │   │ ┌──────────────────────┐ │
│ │ Trigger System   │ │   │ │ Article Store    │ │   │ │ Event Log (Append)   │ │
│ │ Action Executor  │ │   │ │ AI Suggestions   │ │   │ │ Metrics Dashboard    │ │
│ │ Rule Engine      │ │   │ │ Similar Cases    │ │   │ │ GDPR Compliance      │ │
│ └──────────────────┘ │   │ └──────────────────┘ │   │ └──────────────────────┘ │
└──────────────────────┘   └──────────────────────┘   └──────────────────────────┘

                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   PostgreSQL    │ │   Redis Cache   │ │  Elasticsearch  │ │  Object Store   ││
│  │   (Primary DB)  │ │  (Session/RT)   │ │    (Search)     │ │  (Attachments)  ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components Detail

### 1. Identity & Customer Profile Service

**Purpose**: Create unified customer identity across all channels

```
Customer Object
├── id (UUID)
├── identity_graph
│   ├── emails[]
│   ├── phone_numbers[]
│   ├── social_ids[]
│   └── device_fingerprints[]
├── profile
│   ├── name
│   ├── company
│   └── metadata
├── sla_tier (free|standard|premium|enterprise)
├── tags[]
├── segments[]
├── risk_flags[]
├── interaction_history[]
└── created_at / updated_at
```

**Key Capabilities**:
- Anonymous → known user merging
- Cross-channel identity resolution
- Persistent interaction history
- SLA tiering support

### 2. Conversation Engine (System Heart)

**Purpose**: Manage the entire conversation lifecycle across all channels

```
Conversation Object
├── id (UUID)
├── customer_id
├── state (open|awaiting_customer|awaiting_agent|escalated|resolved|reopened)
├── channels_used[]
├── current_channel
├── messages[]
│   ├── id
│   ├── channel
│   ├── direction (inbound|outbound)
│   ├── content
│   ├── attachments[]
│   ├── ai_annotations
│   └── timestamp
├── internal_notes[]
├── automation_events[]
├── audit_log[]
├── assigned_agent_id
├── sla
│   ├── response_due_at
│   ├── resolution_due_at
│   └── breached
├── resolution_id (if escalated)
└── timestamps
```

**State Machine**:
```
         ┌────────────────────────────────────────────────────┐
         │                                                    │
         ▼                                                    │
      [OPEN] ──────► [AWAITING_CUSTOMER] ◄────────────────────┤
         │                   │                                │
         │                   ▼                                │
         │           [AWAITING_AGENT] ◄───────────────────────┤
         │                   │                                │
         ▼                   ▼                                │
    [ESCALATED] ────► [RESOLVED] ────────► [REOPENED] ────────┘
```

**Hard Rule**: A live chat that times out MUST continue via email or messaging under the same Conversation ID.

### 3. First-Contact AI Orchestrator

**Purpose**: Classify, filter, protect human capacity

```
AI Orchestrator Pipeline
├── Intent Classification
│   ├── how_to_guidance
│   ├── account_access_issue
│   ├── transaction_system_failure
│   ├── bug_technical_defect
│   ├── urgent_high_risk
│   └── noise_low_intent
├── Severity Assessment
│   ├── P0 (critical: money, security, trust)
│   ├── P1 (high)
│   ├── P2 (normal)
│   └── P3 (informational)
├── Knowledge Deflection
│   ├── Step-by-step guidance
│   ├── KB article reference
│   ├── Single clarifying question
│   └── Always offer escalation
├── Conversation Annotation
│   ├── Intent
│   ├── Severity
│   ├── Sentiment
│   ├── Extracted entities
│   └── Suspected root cause
├── Human Handoff
│   ├── Structured handoff brief
│   ├── Correct queue routing
│   └── Team notification
└── Learning Loop
    ├── Human corrections → override
    ├── Resolved cases → training
    └── Versioned prompts/rules
```

**Absolute Failsafes**:
- NEVER block escalation
- NEVER fabricate fixes or ETAs
- NEVER argue
- NEVER override humans
- ALWAYS log decisions

### 4. Resolution Orchestration System (ROS)

**Purpose**: Manage complex, long-running issues (24-48h+)

```
Resolution Object
├── id (UUID)
├── conversation_id
├── issue_type (technical|billing|ops|compliance)
├── owning_team (engineering|infra|finance)
├── status
│   ├── investigating
│   ├── awaiting_fix
│   ├── fix_in_progress
│   ├── awaiting_deploy
│   ├── monitoring
│   └── resolved
├── expected_resolution_window
├── sla_clock
│   ├── started_at
│   ├── paused_at
│   └── elapsed
├── internal_notes[]
├── customer_updates[]
├── swarm
│   ├── slack_channel_id
│   ├── participants[]
│   └── status_updates[]
├── root_cause
├── fix_description
└── timestamps
```

**Long-Running Protocol** (>24h):
1. Immediate acknowledgement with case ID + ETA window
2. Continuation channel designated (email default)
3. Automated updates every 12h minimum
4. Updates sent even if status unchanged
5. **Silence is forbidden**

**Role Separation**:
- **Agents**: Manage communication and trust
- **Engineers**: Manage fixes and root cause
- **Customers**: Never speak to engineers directly

### 5. Routing & Queue Engine

```
Routing Logic
├── Skill-based matching
│   └── agent.skills ∩ conversation.required_skills
├── SLA-aware prioritization
│   └── Sort by time_to_breach ASC
├── Availability-aware
│   └── agent.status = available
├── Load balancing
│   └── Least active conversations
└── Escalation triggers
    ├── Time thresholds
    ├── Sentiment degradation
    ├── Keywords (urgent, legal, etc.)
    └── AI confidence < threshold
```

### 6. Event Bus Architecture

```
Event Topics
├── message.received
├── message.sent
├── message.classified
├── conversation.created
├── conversation.state_changed
├── conversation.assigned
├── conversation.escalated
├── resolution.created
├── resolution.status_changed
├── resolution.completed
├── sla.warning
├── sla.breached
├── automation.triggered
├── automation.executed
└── customer.updated
```

---

## Data Flow Diagrams

### Inbound Message Flow

```
[Customer Message]
       │
       ▼
[Channel Adapter] ──► Normalize to NormalizedMessage
       │
       ▼
[Identity Service] ──► Resolve/Create Customer
       │
       ▼
[Conversation Service] ──► Find/Create Conversation
       │
       ▼
[Message Service] ──► Persist Message
       │
       ▼
[Event: message.received]
       │
       ▼
[First-Contact AI]
       │
       ├──► [Intent: How-To] ──► Knowledge Deflection ──► AI Response
       │
       ├──► [Intent: Technical + P0/P1] ──► Create Resolution ──► Swarm
       │
       ├──► [Intent: Account Issue] ──► Route to Agent Queue
       │
       └──► [Low Confidence] ──► Escalate to Human
       │
       ▼
[Conversation Annotated]
       │
       ▼
[Event: conversation.updated]
```

### Resolution Flow

```
[Technical Issue Detected]
       │
       ▼
[Create Resolution Object]
       │
       ▼
[Assign Owning Team]
       │
       ▼
[Create Slack Swarm Channel] (if enabled)
       │
       ▼
[Send Customer Acknowledgement]
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
[Engineering Investigation]    [Proactive Update Timer]
       │                                  │
       ▼                                  ▼
[Status Updates via Slack] ◄─── [12h Update Check]
       │
       ▼
[Resolution Found]
       │
       ▼
[Deploy Fix]
       │
       ▼
[Monitor]
       │
       ▼
[Mark Resolved]
       │
       ├──► [Notify Customer]
       │
       ├──► [Generate AI Summary]
       │
       ├──► [Close Slack Channel]
       │
       └──► [Archive for Training]
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js / Fastify
- **API**: REST + WebSocket (Socket.io)
- **Database**: PostgreSQL (primary), Redis (cache/realtime)
- **Search**: Elasticsearch
- **Event Bus**: Redis Streams (simple) or Kafka (enterprise)
- **AI/ML**: OpenAI API / Local LLM integration

### Frontend
- **Framework**: React with TypeScript
- **State**: Redux Toolkit / Zustand
- **Real-time**: Socket.io client
- **UI**: Tailwind CSS + Headless UI

### Infrastructure
- **Containers**: Docker
- **Orchestration**: Kubernetes (optional)
- **Reverse Proxy**: Nginx / Traefik
- **Object Storage**: MinIO (S3-compatible)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack / Loki

---

## Security Model

### Authentication & Authorization
- JWT-based authentication
- OAuth2 for SSO integration
- Role-Based Access Control (RBAC)

### Roles
- **Admin**: Full system access
- **Supervisor**: Team management, analytics
- **Agent**: Conversation handling
- **Engineer**: Resolution management
- **API**: External integrations

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII masking in logs
- Audit logging (append-only)
- GDPR compliance (export, deletion, consent)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Load Balancer (Nginx/Traefik)                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌────────────┐      ┌────────────┐      ┌────────────┐
       │  API Node  │      │  API Node  │      │  API Node  │
       │    (1)     │      │    (2)     │      │    (3)     │
       └────────────┘      └────────────┘      └────────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │PostgreSQL│  │  Redis   │  │  Kafka   │
             │ (Primary)│  │ Cluster  │  │ Cluster  │
             └──────────┘  └──────────┘  └──────────┘
                    │
                    ▼
             ┌──────────┐
             │PostgreSQL│
             │(Replica) │
             └──────────┘
```

---

## MVP vs Enterprise Roadmap

### Phase 1: MVP (Weeks 1-4)
- [ ] Core conversation engine
- [ ] Web chat channel
- [ ] Email channel
- [ ] Basic AI classification
- [ ] Agent inbox
- [ ] PostgreSQL + Redis

### Phase 2: Enhanced (Weeks 5-8)
- [ ] Resolution orchestration
- [ ] WhatsApp integration
- [ ] Slack swarm integration
- [ ] Knowledge base
- [ ] Basic automation rules

### Phase 3: Scale (Weeks 9-12)
- [ ] Voice channel
- [ ] All social channels
- [ ] Advanced analytics
- [ ] Custom automation builder
- [ ] Multi-tenant support

### Phase 4: Enterprise (Weeks 13+)
- [ ] Custom AI model training
- [ ] Advanced SLA management
- [ ] Compliance certifications
- [ ] White-label support
- [ ] API marketplace

---

## Appendix: Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| First Response Time | Time from message to first human/AI response | < 1 min (chat), < 1 hour (email) |
| Mean Time to Resolution | Average time to resolve conversations | < 4 hours |
| AI Deflection Rate | % of conversations handled without human | 40-60% |
| AI Override Rate | % of AI decisions corrected by humans | < 10% |
| SLA Breach Rate | % of conversations that breach SLA | < 5% |
| Reopen Rate | % of resolved conversations reopened | < 10% |
| Customer Satisfaction | Post-resolution survey score | > 4.5/5 |
