#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

INSTALL_DIR="${INSTALL_DIR:-$HOME/confide-server}"
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
  printf "%sConfide Server Installer %s(Community)%s\n" "${BOLD}" "${DIM}" "${NC}"
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
read -r -p "  Domain (e.g., server.example.com): " DOMAIN || true
if [[ -z "${DOMAIN}" ]]; then
  die "Domain is required."
fi

CERT_DIR="$INSTALL_DIR/certs"

blank
info "Server configuration"
SERVER_NAME="$(prompt_default "Server Name" "My Community Server")"
EMAIL="$(prompt_default "Email" "admin@${DOMAIN}")"

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
DSA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
success "Secrets generated."

blank
info "Preparing installation directory"
run_step "Creating folders at $INSTALL_DIR" mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/config" "$INSTALL_DIR/data"/{postgres,redis,caddy_data,caddy_config}

blank
info "Downloading configuration"
run_step "Fetching docker-compose.yml" curl -fsS "$REPO_URL/infrastructure/deployment/server-compose.yml" -o "$INSTALL_DIR/docker-compose.yml"
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
    reverse_proxy server:8080 {
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
SERVER_NAME_ENV="${SERVER_NAME//\"/\\\"}"
cat > "$INSTALL_DIR/.env" <<EOF
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
DSA_ENCRYPTION_KEY=${DSA_ENCRYPTION_KEY}
SERVER_VERSION=latest

LIMITS_MAX_USERS=100
LIMITS_MAX_UPLOAD_SIZE_MB=100
MESSAGES_RETENTION=30d
DISCOVERY_ENABLED=true
DISCOVERY_DISPLAY_NAME="${SERVER_NAME_ENV}"
CENTRAL_API_URL=https://central.confide.gg/api
EOF
success ".env created."

blank
info "Starting Confide Server"
cd "$INSTALL_DIR"

LOG_FILE="$INSTALL_DIR/install.log"
{
  echo "Installation started at $(date)"
  echo "Working directory: $INSTALL_DIR"
  echo "Domain: $DOMAIN"
} > "$LOG_FILE"

( docker compose up -d ) >> "$LOG_FILE" 2>&1 &
spinner_start "$!" "Booting containers (docker compose up -d)" || die "docker compose failed. See $LOG_FILE"

blank
print_header
success "Installation complete!"
blank
printf "  Server:  %s%s%s\n" "${GREEN}" "$DOMAIN" "${NC}"
printf "  Location:   %s%s%s\n" "${CYAN}" "$INSTALL_DIR" "${NC}"
printf "  Installer logs: %s%s%s\n" "${CYAN}" "$LOG_FILE" "${NC}"
blank
hr
printf "%sNext: Get your Owner Token%s\n" "${BOLD}" "${NC}"
printf "  %s\n" "cd \"$INSTALL_DIR\" && docker compose logs -f server"
blank
printf "%sTip:%s if you only want lines likely containing it:\n" "${DIM}" "${NC}"
printf "  %s\n" "cd \"$INSTALL_DIR\" && docker compose logs server | grep -i \"owner\""
hr
