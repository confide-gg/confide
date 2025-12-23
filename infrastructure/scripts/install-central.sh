#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

INSTALL_DIR="${INSTALL_DIR:-$HOME/confide-central}"
REPO_URL="https://raw.githubusercontent.com/confide-gg/confide/main"

PRIMARY=$'\033[38;2;201;237;123m'
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
CYAN=$PRIMARY
YELLOW=$'\033[1;33m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
NC=$'\033[0m'
hr() { printf "%s\n" "----------------------------------------------------------------"; }
blank() { printf "\n"; }

info() { printf "%s%s%s %s\n" "${CYAN}" "ℹ" "${NC}" "$1"; }
success() { printf "%s%s%s %s\n" "${GREEN}" "✔" "${NC}" "$1"; }
warn() { printf "%s%s%s %s\n" "${YELLOW}" "⚠" "${NC}" "$1"; }
die() { printf "%s%s%s %s\n" "${RED}" "✖" "${NC}" "$1" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing dependency: ${BOLD}$1${NC}. Please install it and re-run."
}

spinner_start() {
  local pid="$1"
  local msg="${2:-Working...}"
  local i=0
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  printf "%s %s" "${DIM}${msg}${NC}" ""
  while kill -0 "$pid" >/dev/null 2>&1; do
    printf "\r%s %s" "${CYAN}${frames[i]}${NC}" "${DIM}${msg}${NC}"
    i=$(((i + 1) % ${#frames[@]}))
    sleep 0.09
  done
  wait "$pid"
  local rc=$?
  printf "\r%s %s\n" "${GREEN}✔${NC}" "$msg"
  return "$rc"
}

run_step() {
  local msg="$1"; shift
  ( "$@" ) >/dev/null 2>&1 &
  spinner_start "$!" "$msg"
}

prompt_default() {
  local prompt="$1"
  local def="$2"
  local val=""
  read -r -p "  ${prompt} (default: ${def}): " val || true
  if [[ -z "${val}" ]]; then
    val="$def"
  fi
  printf "%s" "$val"
}

prompt_required() {
  local prompt="$1"
  local val=""
  read -r -p "  ${prompt}: " val || true
  printf "%s" "$val"
}

escape_sed_replacement() {
  printf "%s" "$1" | sed -e 's/[&/|]/\\&/g'
}

print_header() {
  clear || true
  printf "%s" "${CYAN}"
  cat <<'BANNER'
 ░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓███████▓▒░░▒▓████████▓▒░▒▓█▓▒░▒▓███████▓▒░░▒▓████████▓▒░       ░▒▓██████▓▒░ ░▒▓██████▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░             ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░             ░▒▓█▓▒░      ░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓██████▓▒░ ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓██████▓▒░        ░▒▓█▓▒▒▓███▓▒░▒▓█▓▒▒▓███▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░             ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓██▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░
 ░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓███████▓▒░░▒▓████████▓▒░▒▓██▓▒░░▒▓██████▓▒░ ░▒▓██████▓▒░
BANNER
  printf "%s\n" "${NC}"
  printf "%sConfide Central Server Installer%s\n" "${BOLD}" "${NC}"
  hr
}

on_err() {
  blank
  die "Installation failed. Re-run with a clean terminal, or check: ${BOLD}${LOG_FILE:-"$INSTALL_DIR/install.log"}${NC}"
}
trap on_err ERR

print_header

info "Pre-flight checks"
require_cmd curl
require_cmd openssl
require_cmd sed
success "curl / openssl / sed detected."

blank
info "Docker check"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found."
  if [[ "${OSTYPE:-}" == "darwin"* ]]; then
    blank
    die "On macOS, please install Docker Desktop first, then re-run.\n  Download: https://www.docker.com/products/docker-desktop/"
  fi

  read -r -p "  Auto-install Docker (Linux only)? (y/n) " yn || true
  if [[ "${yn:-}" =~ ^[Yy]$ ]]; then
    run_step "Installing Docker" bash -lc "curl -fsSL https://get.docker.com | sh"
    success "Docker installed."
  else
    die "Docker is required. Exiting."
  fi
else
  success "Docker is present."
fi

blank
info "Detecting public IP"
PUBLIC_IP="$(curl -fsS https://api.ipify.org 2>/dev/null || echo "127.0.0.1")"
success "Public IP: ${BOLD}${PUBLIC_IP}${NC}"

blank
info "Domain configuration"
read -r -p "  Domain (e.g., central.example.com): " DOMAIN || true
if [[ -z "${DOMAIN}" ]]; then
  die "Domain is required."
fi

CERT_DIR="$INSTALL_DIR/certs"

blank
info "Central server configuration"
EMAIL="$(prompt_default "Admin Email" "admin@${DOMAIN}")"

blank
info "S3 Storage configuration (required for file uploads)"
warn "You need an S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO, etc.)"
blank
S3_ACCESS_KEY_ID="$(prompt_required "S3 Access Key ID")"
if [[ -z "${S3_ACCESS_KEY_ID}" ]]; then
  die "S3 Access Key ID is required."
fi
S3_SECRET_ACCESS_KEY="$(prompt_required "S3 Secret Access Key")"
if [[ -z "${S3_SECRET_ACCESS_KEY}" ]]; then
  die "S3 Secret Access Key is required."
fi
S3_BUCKET="$(prompt_required "S3 Bucket Name")"
if [[ -z "${S3_BUCKET}" ]]; then
  die "S3 Bucket Name is required."
fi
S3_REGION="$(prompt_default "S3 Region" "us-east-1")"
S3_ENDPOINT="$(prompt_required "S3 Endpoint (e.g., https://s3.amazonaws.com or https://xxxxx.r2.cloudflarestorage.com)")"
if [[ -z "${S3_ENDPOINT}" ]]; then
  die "S3 Endpoint is required."
fi

blank
info "SSL certificate setup"

if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
  warn "Port 80 is in use. Certbot needs it temporarily."
  read -r -p "  Stop services and continue? (y/n): " yn || true
  if [[ ! "${yn:-}" =~ ^[Yy]$ ]]; then
    die "Port 80 must be available for SSL certificate generation."
  fi
fi

mkdir -p "$CERT_DIR"

info "Obtaining SSL certificate from Let's Encrypt"
docker run --rm -p 80:80 \
  -v "$CERT_DIR/conf:/etc/letsencrypt" \
  -v "$CERT_DIR/www:/var/www/certbot" \
  certbot/certbot certonly --standalone \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN" --non-interactive || die "Certificate generation failed."

if [[ ! -d "$CERT_DIR/conf/live/$DOMAIN" ]]; then
  die "Certificate files not found after generation."
fi

success "SSL certificate obtained for ${BOLD}${DOMAIN}${NC}"

blank
info "Generating secrets"
POSTGRES_PASSWORD="$(openssl rand -hex 16)"
REDIS_PASSWORD="$(openssl rand -hex 16)"
CALLS_RELAY_TOKEN_SECRET="$(openssl rand -hex 32)"
success "Secrets generated."

blank
info "Preparing installation directory"
run_step "Creating folders at $INSTALL_DIR" mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/config" "$INSTALL_DIR/data"/{postgres,redis,caddy_data,caddy_config}

blank
info "Downloading configuration"
run_step "Fetching docker-compose.yml" curl -fsS "$REPO_URL/infrastructure/deployment/central-compose.yml" -o "$INSTALL_DIR/docker-compose.yml"
success "docker-compose.yml downloaded."

blank
info "Configuring docker-compose for SSL"

if [[ "${OSTYPE:-}" == "darwin"* ]]; then
  sed -i '' '/- \.\/config\/Caddyfile:\/etc\/caddy\/Caddyfile/a\
      - ./certs/conf:/etc/caddy/certs:ro
' "$INSTALL_DIR/docker-compose.yml"
else
  sed -i '/- \.\/config\/Caddyfile:\/etc\/caddy\/Caddyfile/a\      - ./certs/conf:/etc/caddy/certs:ro' "$INSTALL_DIR/docker-compose.yml"
fi

success "docker-compose.yml updated for SSL."

blank
info "Generating Caddyfile"
cat > "$INSTALL_DIR/config/Caddyfile" <<EOF
${DOMAIN} {
    tls /etc/caddy/certs/live/${DOMAIN}/fullchain.pem /etc/caddy/certs/live/${DOMAIN}/privkey.pem
    reverse_proxy central:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    encode gzip zstd
    log {
        output stdout
        format json
        level INFO
    }
    header {
        -Server
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}
EOF
success "Caddyfile configured."

blank
info "Writing environment (.env)"
cat > "$INSTALL_DIR/.env" <<EOF
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
CENTRAL_VERSION=latest

DB_MAX_CONNECTIONS=100
DB_API_POOL_SIZE=30
DB_WEBSOCKET_POOL_SIZE=100
WEBSOCKET_MESSAGE_BUFFER_SIZE=256
POSTGRES_MAX_CONNECTIONS=200
REDIS_MAX_MEMORY=512mb

S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_REGION=${S3_REGION}
S3_BUCKET=${S3_BUCKET}
S3_ENDPOINT=${S3_ENDPOINT}
CALLS_RELAY_TOKEN_SECRET=${CALLS_RELAY_TOKEN_SECRET}
EOF
success ".env created."

blank
info "Starting Confide Central Server"
cd "$INSTALL_DIR"

LOG_FILE="$INSTALL_DIR/install.log"
{
  echo "Installation started at $(date)"
  echo "Working directory: $INSTALL_DIR"
  echo "Domain: $DOMAIN"
  echo "Media Relay Port: 10000/udp"
} > "$LOG_FILE"

( docker compose up -d ) >> "$LOG_FILE" 2>&1 &
spinner_start "$!" "Booting containers (docker compose up -d)" || die "docker compose failed. See $LOG_FILE"

blank
print_header
success "Installation complete!"
blank
printf "  Central Server:  %s%s%s\n" "${GREEN}" "$DOMAIN" "${NC}"
printf "  Location:        %s%s%s\n" "${CYAN}" "$INSTALL_DIR" "${NC}"
printf "  Installer logs:  %s%s%s\n" "${CYAN}" "$LOG_FILE" "${NC}"
blank
hr
printf "%sImportant Ports:%s\n" "${BOLD}" "${NC}"
printf "  HTTPS (Web/API): 443\n"
printf "  HTTP3 (QUIC):    443/udp\n"
printf "  Media Relay:     10000/udp\n"
blank
printf "%sFirewall Rules Needed:%s\n" "${BOLD}" "${NC}"
printf "  sudo ufw allow 80/tcp\n"
printf "  sudo ufw allow 443/tcp\n"
printf "  sudo ufw allow 443/udp\n"
printf "  sudo ufw allow 10000/udp\n"
hr
blank
printf "%sNext Steps:%s\n" "${BOLD}" "${NC}"
printf "1. Check logs: %s\n" "cd \"$INSTALL_DIR\" && docker compose logs -f central"
printf "2. Run migrations: %s\n" "docker compose exec central /app/central migrate"
printf "3. Update your DNS to point %s to %s\n" "$DOMAIN" "$PUBLIC_IP"
hr
