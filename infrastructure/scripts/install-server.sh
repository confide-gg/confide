#!/bin/bash
set -e

# --- Configuration ---
INSTALL_DIR="${INSTALL_DIR:-$HOME/confide-server}"
REPO_URL="https://raw.githubusercontent.com/confide-gg/confide/feature/server-installer"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Utilities ---
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✔${NC} $1"
}

error() {
    echo -e "${RED}✖${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    clear
    echo -e "${CYAN}"
    echo "   ______            __  _      __     "
    echo "  / ____/___  ____  / /_(_)____/ /__   "
    echo " / /   / __ \/ __ \/ __/ / __  / _ \  "
    echo "/ /___/ /_/ / / / / /_/ / /_/ /  __/  "
    echo "\____/\____/_/ /_/\__/_/\__,_/\___/   "
    echo "                                      "
    echo "      Server Installer (Community)    "
    echo -e "${NC}"
    echo "----------------------------------------"
}

# --- Main Logic ---

print_header

# 1. Docker Check & Install
if ! command -v docker >/dev/null 2>&1; then
    warn "Docker not found."
    read -p "  Auto-install Docker? (y/n) " yn
    if [[ "$yn" =~ ^[Yy]$ ]]; then
        info "Installing Docker..."
        (curl -fsSL https://get.docker.com | sh) &
        spinner $!
        success "Docker installed successfully."
    else
        error "Docker is required. Exiting."
        exit 1
    fi
else
    success "Docker is present."
fi

# 2. IP Detection
info "Detecting Public IP..."
PUBLIC_IP=$(curl -s https://api.ipify.org || echo "127.0.0.1")
info "Public IP: ${GREEN}$PUBLIC_IP${NC}"
DOMAIN="$PUBLIC_IP"

# 3. Server Details
echo ""
info "Server Configuration"
read -p "  Server Name (default: My Community Server): " SERVER_NAME
if [ -z "$SERVER_NAME" ]; then
    SERVER_NAME="My Community Server"
fi

read -p "  Email for SSL (default: admin@$DOMAIN): " EMAIL
if [ -z "$EMAIL" ]; then
    EMAIL="admin@$DOMAIN"
fi


# 4. Generate Secrets
info "Generating secure passwords..."
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)

# 5. Setup Directories
info "Setting up installation directory at ${CYAN}$INSTALL_DIR${NC}..."
mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/config" "$INSTALL_DIR/data"/{postgres,redis,caddy_data,caddy_config}

# 6. Fetch Configs
echo -n "  Fetching configuration files... "
(
    curl -sSL "$REPO_URL/infrastructure/deployment/config/Caddyfile" -o "$INSTALL_DIR/config/Caddyfile"
    curl -sSL "$REPO_URL/infrastructure/deployment/server-compose.yml" -o "$INSTALL_DIR/docker-compose.yml"
) &
spinner $!
echo ""
success "Configuration downloaded."

# 7. Create .env
cat > "$INSTALL_DIR/.env" <<EOF
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
SERVER_VERSION=latest

# Server Limits & Config
LIMITS_MAX_USERS=100
LIMITS_MAX_UPLOAD_SIZE_MB=100
MESSAGES_RETENTION=30d
MESSAGES_RETENTION=30d
DISCOVERY_ENABLED=true
DISCOVERY_DISPLAY_NAME="${SERVER_NAME}"
CENTRAL_API_URL=https://central.confide.gg/api
EOF
success "Environment configured."

# 7.5 Setup Config
# Download base config (overridden by env vars)
curl -sSL "$REPO_URL/apps/server/config.docker.toml" -o "$INSTALL_DIR/config/config.toml"

# Patch public domain in config.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/public_domain = \".*\"/public_domain = \"$DOMAIN\"/" "$INSTALL_DIR/config/config.toml"
  sed -i '' "s/display_name = \".*\"/display_name = \"$SERVER_NAME\"/" "$INSTALL_DIR/config/config.toml"
else
  sed -i "s/public_domain = \".*\"/public_domain = \"$DOMAIN\"/" "$INSTALL_DIR/config/config.toml"
  sed -i "s/display_name = \".*\"/display_name = \"$SERVER_NAME\"/" "$INSTALL_DIR/config/config.toml"
fi

success "Configuration generated."

# 8. Start Server
info "Starting Confide Server..."
cd "$INSTALL_DIR"

# Log output to file
LOG_FILE="$INSTALL_DIR/install.log"
echo "Installation started at $(date)" > "$LOG_FILE"

# Run docker compose in background, redirecting output to log
docker compose up -d >> "$LOG_FILE" 2>&1 &
PID=$!

# Run spinner
spinner $PID

# Check exit status of the background process
wait $PID
EXIT_CODE=$?

echo ""

if [ $EXIT_CODE -eq 0 ]; then
    print_header
    success "Installation Complete!"
    echo ""
    echo -e "  Dashboard:  ${GREEN}http://$DOMAIN${NC}"
    echo -e "  Location:   ${CYAN}$INSTALL_DIR${NC}"
    echo -e "  Logs:       ${CYAN}$LOG_FILE${NC}"
    echo ""
else
    error "Installation failed. See logs below:"
    echo "----------------------------------------"
    tail -n 20 "$LOG_FILE"
    echo "----------------------------------------"
    exit 1
fi
