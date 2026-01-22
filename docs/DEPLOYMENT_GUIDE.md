# Deployment Guide

## Overview

This guide covers deploying the Omnichannel CRM system in production environments. The system supports:

- **Docker Compose**: Single-server deployment
- **Kubernetes**: Scalable cluster deployment
- **Bare Metal**: Traditional server deployment

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Docker 24+ and Docker Compose 2.x
- Kubernetes 1.27+ (for k8s deployment)
- Node.js 20+ (for development)
- PostgreSQL 15+
- Redis 7+

---

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourorg/omnichannel-crm.git
cd omnichannel-crm

# Copy environment template
cp deployment/docker/.env.example deployment/docker/.env

# Edit configuration
nano deployment/docker/.env
```

### 2. Configure Environment Variables

```bash
# deployment/docker/.env

# Database
DB_PASSWORD=your-secure-database-password

# JWT Authentication
JWT_SECRET=your-256-bit-jwt-secret

# AI Configuration
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key

# Slack Integration (optional)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Storage
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key

# Monitoring
GRAFANA_USER=admin
GRAFANA_PASSWORD=your-grafana-password
```

### 3. Start Services

```bash
cd deployment/docker

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Initialize database
docker-compose exec api npm run db:migrate
docker-compose exec api npm run db:seed
```

### 4. Access Applications

| Service | URL | Credentials |
|---------|-----|-------------|
| Agent Console | http://localhost | Admin login |
| API | http://localhost:3000 | JWT auth |
| Grafana | http://localhost:3001 | admin/password |
| MinIO Console | http://localhost:9001 | minio creds |

---

## Kubernetes Deployment

### 1. Prerequisites

```bash
# Ensure kubectl is configured
kubectl cluster-info

# Install Helm (for dependencies)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add required repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add elastic https://helm.elastic.co
helm repo update
```

### 2. Create Namespace and Secrets

```bash
# Create namespace
kubectl create namespace omnichannel-crm

# Create secrets
kubectl create secret generic crm-secrets \
  --namespace omnichannel-crm \
  --from-literal=DATABASE_URL='postgresql://crm:password@postgres:5432/omnichannel_crm' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --from-literal=AI_API_KEY='your-openai-key' \
  --from-literal=SLACK_BOT_TOKEN='your-slack-token' \
  --from-literal=MINIO_ACCESS_KEY='minio-key' \
  --from-literal=MINIO_SECRET_KEY='minio-secret'
```

### 3. Deploy Dependencies

```bash
# PostgreSQL
helm install postgres bitnami/postgresql \
  --namespace omnichannel-crm \
  --set auth.database=omnichannel_crm \
  --set auth.username=crm \
  --set auth.password=your-db-password \
  --set primary.persistence.size=50Gi

# Redis
helm install redis bitnami/redis \
  --namespace omnichannel-crm \
  --set auth.enabled=false \
  --set master.persistence.size=10Gi

# Kafka
helm install kafka bitnami/kafka \
  --namespace omnichannel-crm \
  --set replicaCount=3 \
  --set persistence.size=50Gi

# Elasticsearch
helm install elasticsearch elastic/elasticsearch \
  --namespace omnichannel-crm \
  --set replicas=3 \
  --set volumeClaimTemplate.resources.requests.storage=50Gi
```

### 4. Deploy Application

```bash
# Apply configurations
kubectl apply -f deployment/kubernetes/configmap.yaml
kubectl apply -f deployment/kubernetes/deployment.yaml

# Wait for rollout
kubectl rollout status deployment/crm-api -n omnichannel-crm

# Run migrations
kubectl exec -it deployment/crm-api -n omnichannel-crm -- npm run db:migrate
```

### 5. Configure Ingress

```bash
# Install NGINX Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Apply ingress configuration
kubectl apply -f deployment/kubernetes/ingress.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n omnichannel-crm

# Check services
kubectl get svc -n omnichannel-crm

# Check ingress
kubectl get ingress -n omnichannel-crm

# View API logs
kubectl logs -f deployment/crm-api -n omnichannel-crm
```

---

## Configuration Reference

### Environment Variables

#### Core Application

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment | Yes | production |
| `PORT` | API port | No | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `JWT_EXPIRY` | Token expiry | No | 1h |

#### AI Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AI_PROVIDER` | AI provider (openai/anthropic/local) | Yes | openai |
| `AI_API_KEY` | Provider API key | Yes | - |
| `AI_MODEL` | Model name | No | gpt-4 |
| `AI_CONFIDENCE_THRESHOLD` | Min confidence for auto-actions | No | 0.7 |

#### Channel Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SENDGRID_API_KEY` | SendGrid for email | No | - |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business | No | - |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp token | No | - |
| `TWILIO_ACCOUNT_SID` | Twilio for voice/SMS | No | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth | No | - |

#### Slack Integration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SLACK_BOT_TOKEN` | Slack bot token | No | - |
| `SLACK_SIGNING_SECRET` | Webhook verification | No | - |
| `SLACK_CHANNEL_PREFIX` | Resolution channel prefix | No | incident |

#### Storage

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `STORAGE_PROVIDER` | Storage backend | No | local |
| `MINIO_ENDPOINT` | MinIO endpoint | No | - |
| `MINIO_ACCESS_KEY` | MinIO access key | No | - |
| `MINIO_SECRET_KEY` | MinIO secret key | No | - |
| `MINIO_BUCKET` | Attachment bucket | No | crm-attachments |

---

## Database Setup

### Initial Migration

```bash
# Run migrations
npm run db:migrate

# Or with Docker
docker-compose exec api npm run db:migrate
```

### Seed Data

```bash
# Create admin user and sample data
npm run db:seed

# Seed includes:
# - Admin user (admin@company.com / changeme)
# - Sample SLA configurations
# - Default automation rules
# - Knowledge base categories
```

### Backup & Restore

```bash
# Backup PostgreSQL
pg_dump -h localhost -U crm omnichannel_crm > backup.sql

# Restore
psql -h localhost -U crm omnichannel_crm < backup.sql

# Backup with Docker
docker-compose exec postgres pg_dump -U crm omnichannel_crm > backup.sql
```

---

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

```bash
# Install certbot
apt install certbot

# Obtain certificate
certbot certonly --standalone -d crm.yourdomain.com -d api.crm.yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem
```

### NGINX Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name crm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.crm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

---

## Channel Setup

### Email (SendGrid)

1. Create SendGrid account
2. Generate API key
3. Configure inbound parse webhook:
   - URL: `https://api.crm.yourdomain.com/webhooks/email/sendgrid`
   - Domain: `support.yourdomain.com`

### WhatsApp Business

1. Create Meta Business account
2. Set up WhatsApp Business API
3. Configure webhook:
   - URL: `https://api.crm.yourdomain.com/webhooks/whatsapp`
   - Verify token: Match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### Slack Integration

1. Create Slack App at api.slack.com
2. Enable Socket Mode or Events API
3. Configure OAuth scopes:
   - `channels:manage`
   - `chat:write`
   - `users:read`
   - `channels:history`
4. Install to workspace
5. Add webhook URL: `https://api.crm.yourdomain.com/webhooks/slack/events`

---

## Monitoring Setup

### Grafana Dashboards

Pre-configured dashboards are included for:

- **System Overview**: CPU, memory, request rates
- **Conversations**: Volume, response times, SLA compliance
- **AI Performance**: Classification accuracy, deflection rates
- **Resolutions**: Active incidents, MTTR, recurrence

Access at: `http://localhost:3001` (or your Grafana URL)

### Alerting Rules

Configure alerts in Prometheus:

```yaml
groups:
  - name: crm-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected

      - alert: SLABreachRisk
        expr: crm_conversations_sla_minutes_remaining < 15
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: Conversation at risk of SLA breach

      - alert: QueueBacklog
        expr: crm_queue_size > 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Large queue backlog
```

---

## Scaling

### Horizontal Scaling

```bash
# Scale API pods
kubectl scale deployment crm-api --replicas=5 -n omnichannel-crm

# Scale workers
kubectl scale deployment crm-worker --replicas=4 -n omnichannel-crm

# Auto-scaling is configured via HPA
kubectl get hpa -n omnichannel-crm
```

### Database Scaling

For high-volume deployments:

1. **Read Replicas**: Configure PostgreSQL streaming replication
2. **Connection Pooling**: Use PgBouncer
3. **Partitioning**: Enable table partitioning for event_log

### Redis Clustering

For enterprise scale:

```bash
helm upgrade redis bitnami/redis \
  --set cluster.enabled=true \
  --set cluster.slaveCount=2
```

---

## Troubleshooting

### Common Issues

#### API Won't Start

```bash
# Check logs
docker-compose logs api

# Common causes:
# - Database not ready (wait for postgres healthcheck)
# - Missing environment variables
# - Port already in use
```

#### Database Connection Failed

```bash
# Test connection
docker-compose exec api npx prisma db pull

# Check PostgreSQL logs
docker-compose logs postgres
```

#### WebSocket Connection Issues

```bash
# Ensure NGINX is configured for WebSocket
# Check for proper proxy headers
# Verify firewall allows WebSocket traffic
```

#### AI Classification Slow

```bash
# Check API key validity
# Verify rate limits not exceeded
# Consider using faster model (gpt-3.5-turbo)
```

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Database health
curl http://localhost:3000/health/db
```

### Log Access

```bash
# Docker logs
docker-compose logs -f --tail=100 api

# Kubernetes logs
kubectl logs -f deployment/crm-api -n omnichannel-crm

# Loki queries (via Grafana)
{app="crm-api"} |= "error"
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Configure TLS/SSL certificates
- [ ] Enable firewall rules
- [ ] Set up network policies (Kubernetes)
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up audit logging
- [ ] Configure backup encryption
- [ ] Review RBAC permissions
- [ ] Enable 2FA for admin accounts

---

## Maintenance

### Regular Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| Database backup | Daily | `pg_dump ...` |
| Log rotation | Daily | Automatic (Docker/k8s) |
| Certificate renewal | 60 days | `certbot renew` |
| Dependency updates | Monthly | `npm audit fix` |
| Security patches | As needed | Rolling update |

### Updates

```bash
# Pull latest images
docker-compose pull

# Rolling update
docker-compose up -d

# Kubernetes rolling update
kubectl set image deployment/crm-api api=omnichannel-crm/api:v1.2.0 -n omnichannel-crm
```

---

## Support

- **Documentation**: `/docs` folder
- **API Reference**: `https://api.crm.yourdomain.com/docs`
- **Issues**: GitHub Issues
- **Community**: Discord/Slack

---

## MVP Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Admin user created
- [ ] Email channel configured
- [ ] Web chat widget deployed
- [ ] SSL certificates installed
- [ ] Monitoring dashboards active
- [ ] Backup schedule configured
- [ ] First agent onboarded
