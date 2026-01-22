# Omnichannel CRM

## Self-Hosted Customer Care Management Platform

A production-grade, self-hosted omnichannel Customer Care Management Platform comparable to Salesforce Service Cloud + Slack Swarming, featuring:

- **First-Contact AI Orchestrator** - Intelligent classification, noise filtering, and human capacity protection
- **Resolution Orchestration System** - Complex issue management for 24-48h+ technical problems
- **Unified Conversation Timeline** - Zero context loss across all channels

---

## Core Principles

1. **One Customer Identity** - Unified profile across all channels
2. **One Conversation Timeline** - Many channels, single thread
3. **Conversations Never End** - They change state, never disappear
4. **Humans are Scarce** - AI protects human capacity
5. **Engineers Fix Problems** - Agents manage trust
6. **Silence is Failure** - Proactive communication always

---

## Features

### Omnichannel Support
- Web/App Live Chat (WebSocket + HTTP fallback)
- Email (SMTP/IMAP/Webhooks)
- WhatsApp Business API
- Facebook Messenger
- Instagram DMs
- Twitter/X DMs
- Voice (SIP/Twilio)
- SMS

### First-Contact AI
- **Intent Classification** - Automatically categorize every message
- **Severity Assessment** - P0-P3 priority assignment
- **Knowledge Deflection** - Answer how-to questions automatically
- **Conversation Annotation** - Enrich with sentiment, entities, root cause
- **Human Handoff** - Structured briefs for seamless escalation
- **Learning Loop** - Continuous improvement from human corrections

### Resolution Orchestration
- **Long-Running Issue Tracking** - Manage 24-48h+ technical problems
- **Slack Swarming** - Auto-create channels, sync bidirectionally
- **Proactive Updates** - Automated customer communication
- **Role Separation** - Agents manage trust, engineers manage fixes
- **Recurrence Detection** - Flag and escalate repeat issues

### Agent Experience
- **Unified Inbox** - All channels, one view
- **Customer Timeline** - Complete interaction history
- **AI Suggestions** - Responses, KB articles, similar cases
- **SLA Tracking** - Real-time breach warnings
- **Internal Collaboration** - Notes, mentions, threads

### Analytics & Compliance
- First Response Time
- Mean Time to Resolution
- AI Deflection Rate
- SLA Compliance
- GDPR-Ready (export, deletion, consent)

---

## Architecture

```
Channel Layer → Ingestion → AI Orchestrator → Conversation Engine → Routing → Action
                                    ↓
                         Resolution Orchestration
                                    ↓
                              Slack Swarm
```

See [Architecture Documentation](docs/ARCHITECTURE.md) for detailed diagrams.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenAI API key (or Anthropic/local LLM)

### Installation

```bash
# Clone repository
git clone https://github.com/yourorg/omnichannel-crm.git
cd omnichannel-crm

# Configure environment
cp deployment/docker/.env.example deployment/docker/.env
nano deployment/docker/.env  # Add your API keys

# Start services
cd deployment/docker
docker-compose up -d

# Run migrations
docker-compose exec api npm run db:migrate

# Access the application
open http://localhost
```

Default credentials: `admin@company.com` / `changeme`

---

## Project Structure

```
omnichannel-crm/
├── backend/
│   ├── src/
│   │   ├── core/           # Core engines (Conversation, AI, Resolution)
│   │   ├── adapters/       # Channel adapters (Email, WhatsApp, etc.)
│   │   ├── services/       # Business logic services
│   │   ├── api/            # REST API routes
│   │   ├── models/         # TypeScript interfaces
│   │   └── events/         # Event handlers
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Redux store
│   │   └── hooks/          # Custom hooks
│   └── Dockerfile
├── deployment/
│   ├── docker/             # Docker Compose configuration
│   └── kubernetes/         # Kubernetes manifests
├── docs/
│   ├── ARCHITECTURE.md     # System architecture
│   ├── DATABASE_SCHEMA.md  # Database design
│   ├── API_SPECIFICATION.md # API reference
│   └── DEPLOYMENT_GUIDE.md # Deployment instructions
└── README.md
```

---

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Authentication secret |
| `AI_API_KEY` | OpenAI/Anthropic API key |

### Optional Integrations

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | Email via SendGrid |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API |
| `SLACK_BOT_TOKEN` | Slack integration |
| `TWILIO_AUTH_TOKEN` | Voice/SMS via Twilio |

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for complete configuration.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and diagrams |
| [Database Schema](docs/DATABASE_SCHEMA.md) | PostgreSQL schema |
| [API Specification](docs/API_SPECIFICATION.md) | REST API reference |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Installation and operations |

---

## Roadmap

### Phase 1: MVP (Weeks 1-4)
- [x] Core conversation engine
- [x] Web chat channel
- [x] Email channel
- [x] Basic AI classification
- [x] Agent inbox

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

---

## Technology Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Search**: Elasticsearch
- **Events**: Kafka / Redis Streams
- **AI**: OpenAI / Anthropic / Local LLM

### Frontend
- **Framework**: React + TypeScript
- **State**: Redux Toolkit
- **Real-time**: Socket.io
- **Styling**: Tailwind CSS

### Infrastructure
- **Containers**: Docker
- **Orchestration**: Kubernetes
- **Storage**: MinIO (S3-compatible)
- **Monitoring**: Prometheus + Grafana

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

## Final Word

This is not just a CRM, chatbot, or helpdesk.

**This is a trust engine:**

- Conversations are preserved
- Noise is filtered
- Problems are owned
- Silence is eliminated

Get the Conversation Engine, First-Contact AI, and Resolution Orchestration System right — and everything else becomes replaceable.
