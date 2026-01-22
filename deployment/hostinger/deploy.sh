#!/bin/bash
# =============================================================================
# Omnichannel CRM - Hostinger VPS Deployment Script
# =============================================================================
# Usage: ./deploy.sh [command]
# Commands: setup, deploy, update, backup, restore, logs, status
# =============================================================================

set -e

# Configuration
APP_NAME="omnichannel-crm"
APP_DIR="/home/crm/omnichannel-crm"
BACKUP_DIR="/home/crm/backups"
DOCKER_COMPOSE_DIR="$APP_DIR/deployment/docker"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# INITIAL SETUP
# =============================================================================

setup_server() {
    log_info "Starting initial server setup..."

    # Update system
    log_info "Updating system packages..."
    sudo apt update && sudo apt upgrade -y

    # Install dependencies
    log_info "Installing dependencies..."
    sudo apt install -y \
        curl wget git \
        nginx certbot python3-certbot-nginx \
        htop iotop net-tools \
        fail2ban ufw

    # Install Docker
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
    else
        log_info "Docker already installed"
    fi

    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    else
        log_info "Docker Compose already installed"
    fi

    # Create directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$APP_DIR"

    # Configure firewall
    log_info "Configuring firewall..."
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow http
    sudo ufw allow https
    sudo ufw --force enable

    # Configure fail2ban
    log_info "Configuring fail2ban..."
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban

    log_success "Server setup complete!"
    log_warning "Please logout and login again for Docker group to take effect"
}

# =============================================================================
# DEPLOYMENT
# =============================================================================

deploy() {
    log_info "Starting deployment..."

    cd "$APP_DIR"

    # Check if .env exists
    if [ ! -f "$DOCKER_COMPOSE_DIR/.env" ]; then
        log_error "Environment file not found. Please create $DOCKER_COMPOSE_DIR/.env"
        exit 1
    fi

    cd "$DOCKER_COMPOSE_DIR"

    # Pull latest images
    log_info "Pulling Docker images..."
    docker-compose pull

    # Build custom images
    log_info "Building application..."
    docker-compose build

    # Start services
    log_info "Starting services..."
    docker-compose up -d

    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30

    # Run migrations
    log_info "Running database migrations..."
    docker-compose exec -T api npm run db:migrate || true

    # Health check
    if curl -s http://localhost:3000/health | grep -q "healthy"; then
        log_success "Deployment successful! API is healthy"
    else
        log_warning "API health check failed. Check logs with: docker-compose logs api"
    fi

    # Show status
    docker-compose ps
}

# =============================================================================
# UPDATE
# =============================================================================

update() {
    log_info "Starting update..."

    cd "$APP_DIR"

    # Create backup before update
    backup

    # Pull latest code
    log_info "Pulling latest code..."
    git pull

    cd "$DOCKER_COMPOSE_DIR"

    # Rebuild and restart
    log_info "Rebuilding containers..."
    docker-compose build
    docker-compose up -d

    # Run migrations
    log_info "Running database migrations..."
    docker-compose exec -T api npm run db:migrate || true

    log_success "Update complete!"
}

# =============================================================================
# BACKUP
# =============================================================================

backup() {
    log_info "Creating backup..."

    DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$DATE"

    mkdir -p "$BACKUP_FILE"

    cd "$DOCKER_COMPOSE_DIR"

    # Backup database
    log_info "Backing up database..."
    docker-compose exec -T postgres pg_dump -U crm omnichannel_crm > "$BACKUP_FILE/database.sql"

    # Backup MinIO data
    log_info "Backing up file storage..."
    docker-compose exec -T minio mc mirror /data "$BACKUP_FILE/minio" 2>/dev/null || true

    # Backup environment file
    cp .env "$BACKUP_FILE/.env"

    # Compress
    log_info "Compressing backup..."
    tar -czf "$BACKUP_FILE.tar.gz" -C "$BACKUP_DIR" "backup_$DATE"
    rm -rf "$BACKUP_FILE"

    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete

    log_success "Backup created: $BACKUP_FILE.tar.gz"
}

# =============================================================================
# RESTORE
# =============================================================================

restore() {
    if [ -z "$1" ]; then
        log_error "Please specify backup file: ./deploy.sh restore backup_20240115_120000.tar.gz"
        ls -la "$BACKUP_DIR"
        exit 1
    fi

    BACKUP_FILE="$BACKUP_DIR/$1"

    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    log_warning "This will restore from backup. Current data will be overwritten!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring from backup..."

    # Extract backup
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    BACKUP_NAME=$(ls "$TEMP_DIR")

    cd "$DOCKER_COMPOSE_DIR"

    # Restore database
    log_info "Restoring database..."
    docker-compose exec -T postgres psql -U crm omnichannel_crm < "$TEMP_DIR/$BACKUP_NAME/database.sql"

    # Cleanup
    rm -rf "$TEMP_DIR"

    log_success "Restore complete!"
}

# =============================================================================
# LOGS
# =============================================================================

show_logs() {
    cd "$DOCKER_COMPOSE_DIR"
    SERVICE=${1:-api}
    docker-compose logs -f --tail=100 "$SERVICE"
}

# =============================================================================
# STATUS
# =============================================================================

show_status() {
    cd "$DOCKER_COMPOSE_DIR"

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "           Omnichannel CRM - System Status"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    # Docker status
    echo "Docker Containers:"
    docker-compose ps
    echo ""

    # Health check
    echo "Health Check:"
    if curl -s http://localhost:3000/health 2>/dev/null | grep -q "healthy"; then
        echo "  API: ✅ Healthy"
    else
        echo "  API: ❌ Unhealthy"
    fi

    # Disk usage
    echo ""
    echo "Disk Usage:"
    df -h / | tail -1 | awk '{print "  Total: " $2 "  Used: " $3 "  Available: " $4 " (" $5 " used)"}'

    # Memory usage
    echo ""
    echo "Memory Usage:"
    free -h | grep Mem | awk '{print "  Total: " $2 "  Used: " $3 "  Available: " $7}'

    # Docker resource usage
    echo ""
    echo "Container Resources:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -10

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
}

# =============================================================================
# SSL SETUP
# =============================================================================

setup_ssl() {
    DOMAIN=$1

    if [ -z "$DOMAIN" ]; then
        log_error "Please specify domain: ./deploy.sh ssl yourdomain.com"
        exit 1
    fi

    log_info "Setting up SSL for $DOMAIN..."

    # Create NGINX config
    sudo tee /etc/nginx/sites-available/crm > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN api.$DOMAIN;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name api.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx

    # Get SSL certificate
    sudo certbot --nginx -d "$DOMAIN" -d "api.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN"

    log_success "SSL setup complete for $DOMAIN"
}

# =============================================================================
# MAIN
# =============================================================================

case "$1" in
    setup)
        setup_server
        ;;
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    status)
        show_status
        ;;
    ssl)
        setup_ssl "$2"
        ;;
    *)
        echo "Omnichannel CRM Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial server setup (run once)"
        echo "  deploy  - Deploy application"
        echo "  update  - Update to latest version"
        echo "  backup  - Create backup"
        echo "  restore - Restore from backup"
        echo "  logs    - View logs (optional: service name)"
        echo "  status  - Show system status"
        echo "  ssl     - Setup SSL certificate"
        echo ""
        echo "Examples:"
        echo "  $0 setup"
        echo "  $0 deploy"
        echo "  $0 logs api"
        echo "  $0 ssl yourdomain.com"
        ;;
esac
