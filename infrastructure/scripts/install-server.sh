#!/bin/bash
set -e

# Confide Community Server Installer
# This script installs and configures a Confide community server

CONFIDE_VERSION="${CONFIDE_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/confide-server}"
REGISTRY="ghcr.io"
IMAGE_NAME="confide-gg/confide/server"

echo "============================================"
echo "Confide Community Server Installer"
echo "============================================"
echo

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is not installed. Please install Docker first."; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "Error: Docker Compose is not installed."; exit 1; }

echo "✓ Docker found"
echo

# Prompt for configuration
read -p "Enter your server's public domain (e.g., confide.example.com): " SERVER_DOMAIN
read -p "Enter HTTP port [8080]: " SERVER_PORT
SERVER_PORT=${SERVER_PORT:-8080}

read -p "Enter PostgreSQL port [5432]: " POSTGRES_PORT
POSTGRES_PORT=${POSTGRES_PORT:-5432}

read -p "Enter Redis port [6379]: " REDIS_PORT
REDIS_PORT=${REDIS_PORT:-6379}

read -p "Enter server display name: " DISPLAY_NAME
read -p "Enter server description [Optional]: " DESCRIPTION

read -p "Enable discovery (register with Central)? [y/N]: " ENABLE_DISCOVERY
ENABLE_DISCOVERY=${ENABLE_DISCOVERY:-n}

CENTRAL_URL=""
if [[ "$ENABLE_DISCOVERY" =~ ^[Yy]$ ]]; then
    read -p "Enter Central server URL (e.g., https://central.confide.gg): " CENTRAL_URL
fi

# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -hex 16)

echo
echo "Creating installation directory at $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  server:
    image: ${REGISTRY}/${IMAGE_NAME}:${CONFIDE_VERSION}
    container_name: confide-server
    ports:
      - "${SERVER_PORT}:8080"
    environment:
      - DATABASE_URL=postgres://confide:\${POSTGRES_PASSWORD}@postgres:5432/confide_server
      - REDIS_URL=redis://redis:6379
      - RUST_LOG=info,confide_server=info
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8080
    volumes:
      - ./config.toml:/app/config.toml:ro
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3

  postgres:
    image: postgres:17.2-alpine
    container_name: confide-server-postgres
    environment:
      POSTGRES_USER: confide
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: confide_server
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U confide"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7.4-alpine
    container_name: confide-server-redis
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    command:
      - "redis-server"
      - "--maxmemory"
      - "200mb"
      - "--maxmemory-policy"
      - "allkeys-lru"

volumes:
  postgres_data:
  redis_data:
EOF

# Create config.toml
cat > config.toml <<EOF
[server]
host = "0.0.0.0"
port = 8080
public_domain = "${SERVER_DOMAIN}"

[database]
max_connections = 50

[limits]
max_users = 1000
max_upload_size_mb = 100

[messages]
retention = "30d"

[discovery]
enabled = $([ "$ENABLE_DISCOVERY" = "y" ] && echo "true" || echo "false")
display_name = "${DISPLAY_NAME}"
description = "${DESCRIPTION}"

[uploads]
directory = "/app/uploads"
max_file_size_mb = 25
EOF

# Create .env file
cat > .env <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF

echo
echo "✓ Configuration created"
echo

# Pull and start services
echo "Pulling Docker images..."
docker compose pull

echo
echo "Starting services..."
docker compose up -d

echo
echo "Waiting for server to start..."
sleep 10

# Get the owner token
echo
echo "============================================"
echo "Installation Complete!"
echo "============================================"
echo
echo "Your Confide server is now running!"
echo
echo "Server URL: http://${SERVER_DOMAIN}:${SERVER_PORT}"
echo
echo "Important: Check the logs for your Owner Token:"
docker compose logs server | grep "Owner Token" || echo "Run: docker compose logs server | grep 'Owner Token'"
echo
echo "Useful commands:"
echo "  View logs:     docker compose logs -f"
echo "  Stop server:   docker compose stop"
echo "  Start server:  docker compose start"
echo "  Restart:       docker compose restart"
echo "  Update:        docker compose pull && docker compose up -d"
echo
echo "Configuration files are in: $INSTALL_DIR"
echo "============================================"
