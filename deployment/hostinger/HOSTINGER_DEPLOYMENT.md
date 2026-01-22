# Hostinger Deployment Guide

## Overview

This guide covers deploying the Omnichannel CRM system on Hostinger. Hostinger offers several hosting options suitable for this application:

1. **VPS Hosting** (Recommended) - Full control with Docker support
2. **Cloud Hosting** - Managed with Node.js support
3. **Web Hosting** - Limited, frontend only

---

## Option 1: VPS Hosting (Recommended)

### Requirements
- VPS Plan: KVM 2 or higher
  - 2+ vCPU
  - 8GB+ RAM
  - 80GB+ SSD
  - Ubuntu 22.04 LTS

### Step 1: Initial Server Setup

```bash
# Connect to your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create non-root user
adduser crm
usermod -aG docker crm
usermod -aG sudo crm

# Switch to crm user
su - crm
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourorg/omnichannel-crm.git
cd omnichannel-crm

# Create environment file
cp deployment/docker/.env.example deployment/docker/.env

# Edit configuration
nano deployment/docker/.env
```

### Step 3: Configure Environment Variables

```bash
# deployment/docker/.env

# REQUIRED - Change these!
DB_PASSWORD=your-secure-database-password-here
JWT_SECRET=your-256-bit-jwt-secret-here

# AI Configuration
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key

# Storage
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key

# Monitoring
GRAFANA_USER=admin
GRAFANA_PASSWORD=your-grafana-password

# Optional: Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Optional: Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# Optional: WhatsApp Business
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
```

### Step 4: Deploy with Docker Compose

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

### Step 5: Configure NGINX Reverse Proxy

```bash
# Create NGINX configuration
sudo nano /etc/nginx/sites-available/crm
```

```nginx
# /etc/nginx/sites-available/crm

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Frontend
server {
    listen 80;
    server_name crm.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API
server {
    listen 80;
    server_name api.crm.yourdomain.com;

    location / {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}

# Grafana (optional, restrict access)
server {
    listen 80;
    server_name monitoring.crm.yourdomain.com;

    # IP restriction (optional)
    # allow 1.2.3.4;
    # deny all;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

### Step 6: SSL Certificate (Let's Encrypt)

```bash
# Obtain SSL certificates
sudo certbot --nginx -d crm.yourdomain.com -d api.crm.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

### Step 7: Configure Firewall

```bash
# Install UFW
sudo apt install ufw

# Configure rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 8: Setup Automatic Backups

```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/home/crm/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec crm-postgres pg_dump -U crm omnichannel_crm > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

```bash
# Make executable
chmod +x ~/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add line:
```
0 2 * * * /home/crm/backup.sh >> /home/crm/backup.log 2>&1
```

---

## Option 2: Cloud Hosting (Node.js)

For Hostinger Cloud Hosting with Node.js support:

### Limitations
- No Docker support
- External database required (use Hostinger MySQL or external PostgreSQL)
- No Kafka/Redis (use cloud services)

### Step 1: Prepare Application

```bash
# Build the backend for production
cd backend
npm install
npm run build
```

### Step 2: Configure for Cloud Hosting

Create `hostinger.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'crm-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
```

### Step 3: External Services

For Cloud Hosting, you'll need external services:

| Service | Recommended Provider |
|---------|---------------------|
| PostgreSQL | Supabase, Neon, Railway |
| Redis | Upstash, Redis Cloud |
| Object Storage | Cloudflare R2, AWS S3 |
| Monitoring | Grafana Cloud |

### Step 4: Deploy via Git

1. Push to GitHub/GitLab
2. Connect repository to Hostinger
3. Configure build commands:
   - Build: `cd backend && npm install && npm run build`
   - Start: `cd backend && npm start`

---

## Option 3: Frontend Only (Web Hosting)

For basic web hosting, deploy only the frontend:

### Step 1: Build Frontend

```bash
cd frontend
npm install
npm run build
```

### Step 2: Upload to Hostinger

1. Login to Hostinger hPanel
2. Go to File Manager
3. Upload contents of `frontend/dist` to `public_html`

### Step 3: Configure .htaccess

```apache
# public_html/.htaccess
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

---

## DNS Configuration

### Required DNS Records

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | crm | VPS IP | 3600 |
| A | api.crm | VPS IP | 3600 |
| A | monitoring.crm | VPS IP | 3600 |
| CNAME | www.crm | crm.yourdomain.com | 3600 |

### Email DNS Records (if using email channel)

| Type | Name | Value |
|------|------|-------|
| MX | support | Your email provider |
| TXT | support | SPF record |
| TXT | _dmarc.support | DMARC record |

---

## Post-Deployment Checklist

### Security
- [ ] Changed all default passwords
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Non-root user created
- [ ] SSH key authentication enabled

### Application
- [ ] Database migrations run
- [ ] Admin user created
- [ ] SLA configurations set
- [ ] AI provider configured
- [ ] At least one channel enabled

### Monitoring
- [ ] Health endpoints accessible
- [ ] Grafana dashboards configured
- [ ] Log aggregation working
- [ ] Alerting rules set up

### Backup
- [ ] Automated backups configured
- [ ] Backup restoration tested
- [ ] Off-site backup storage configured

---

## Maintenance Commands

```bash
# View all services
docker-compose ps

# Restart a service
docker-compose restart api

# View logs
docker-compose logs -f api

# Update to new version
git pull
docker-compose build
docker-compose up -d

# Database backup
docker exec crm-postgres pg_dump -U crm omnichannel_crm > backup.sql

# Database restore
docker exec -i crm-postgres psql -U crm omnichannel_crm < backup.sql

# Check disk usage
df -h
docker system df

# Clean up Docker
docker system prune -a
```

---

## Troubleshooting

### API Not Responding
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api

# Restart
docker-compose restart api
```

### Database Connection Issues
```bash
# Check PostgreSQL
docker-compose logs postgres

# Test connection
docker exec -it crm-postgres psql -U crm -d omnichannel_crm -c "SELECT 1"
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### High Memory Usage
```bash
# Check memory
free -h

# Check Docker memory
docker stats

# Restart services
docker-compose restart
```

---

## Support

- **Documentation**: `/docs` folder
- **API Reference**: `https://api.crm.yourdomain.com/docs`
- **Issues**: GitHub Issues
- **Hostinger Support**: https://support.hostinger.com
