#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$MONOREPO_ROOT/infrastructure/docker"
CLIENT_DIR="$MONOREPO_ROOT/apps/client"

PRIMARY=$'\033[38;2;201;237;123m'  # #c9ed7b
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
NC=$'\033[0m'

hr() { printf "%s\n" "----------------------------------------------------------------"; }
blank() { printf "\n"; }

log_info() { printf "%s%s%s %s\n" "${PRIMARY}" "ℹ" "${NC}" "$1"; }
log_success() { printf "%s%s%s %s\n" "${GREEN}" "✔" "${NC}" "$1"; }
log_warn() { printf "%s%s%s %s\n" "${YELLOW}" "⚠" "${NC}" "$1"; }
log_error() { printf "%s%s%s %s\n" "${RED}" "✖" "${NC}" "$1" >&2; }

die() { log_error "$1"; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: ${BOLD}$1${NC}"; }

spinner_start() {
  local pid="$1"
  local msg="${2:-Working...}"
  local log_file="${3:-}"
  local i=0
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  printf "%s %s" "${DIM}${msg}${NC}" ""
  while kill -0 "$pid" >/dev/null 2>&1; do
    printf "\r%s %s" "${PRIMARY}${frames[i]}${NC}" "${DIM}${msg}${NC}"
    i=$(((i + 1) % ${#frames[@]}))
    sleep 0.09
  done
  wait "$pid"
  local rc=$?
  if [[ "$rc" -eq 0 ]]; then
    printf "\r%s %s\n" "${GREEN}✔${NC}" "$msg"
  else
    printf "\r%s %s\n" "${RED}✖${NC}" "$msg"
  fi
  return "$rc"
}

run_step() {
  local msg="$1"; shift
  local log_file="${TMPDIR:-/tmp}/confide-setup-local.$$.log"

  if [[ "${CONFIDE_VERBOSE:-0}" == "1" ]]; then
    log_info "$msg"
    "$@"
    return
  fi

  ( "$@" ) >"$log_file" 2>&1 &
  if ! spinner_start "$!" "$msg" "$log_file"; then
    blank
    log_error "Command failed. Last 40 lines:"
    tail -n 40 "$log_file" 2>/dev/null || true
    blank
    die "Re-run with ${BOLD}CONFIDE_VERBOSE=1${NC} for full output."
  fi
}

print_header() {
  clear || true
  printf "%s" "${PRIMARY}"
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
  printf "%sConfide Local Development Setup %s(Local)%s\n" "${BOLD}" "${DIM}" "${NC}"
  hr
}

check_docker() {
    require_cmd docker
    if ! docker info &> /dev/null; then
        die "Docker daemon is not running. Please start Docker."
    fi
    log_success "Docker is running"
}

check_bun() {
    require_cmd bun
    log_success "Bun is installed: $(bun --version)"
}

print_usage() {
    blank
    print_header
    blank
    printf "%sUsage:%s %s\n" "${BOLD}" "${NC}" "./setup-local.sh [command]"
    blank
    printf "%sCommands:%s\n" "${BOLD}" "${NC}"
    printf "  %-12s %s\n" "up"           "Start all services (Central + Server)"
    printf "  %-12s %s\n" "central"      "Start Central services only"
    printf "  %-12s %s\n" "server"       "Start Server services only"
    printf "  %-12s %s\n" "reset-server" "Rebuild and restart Server services only"
    printf "  %-12s %s\n" "down"         "Stop all services"
    printf "  %-12s %s\n" "build"        "Build Docker images"
    printf "  %-12s %s\n" "rebuild"      "Rebuild and restart services"
    printf "  %-12s %s\n" "logs"         "Show logs from all services"
    printf "  %-12s %s\n" "client"       "Run the client (bun run tauri dev)"
    printf "  %-12s %s\n" "clean"        "Stop services and remove volumes"
    printf "  %-12s %s\n" "status"       "Show status of services"
    printf "  %-12s %s\n" "help"         "Show this message"
    blank
    printf "%sTip:%s set %sCONFIDE_VERBOSE=1%s to see full docker output.\n" "${DIM}" "${NC}" "${BOLD}" "${NC}"
    blank
}

start_services() {
    print_header
    log_info "Starting ALL Confide services..."
    cd "$DOCKER_DIR"
    run_step "docker compose up -d --build" docker compose up -d --build
    blank
    log_success "All services started!"
    print_endpoints
}

start_central() {
    print_header
    log_info "Starting Confide Central services..."
    cd "$DOCKER_DIR"
    run_step "Starting central services" docker compose up -d --build central central-postgres central-redis
    blank
    log_success "Central services started!"
    printf "  Endpoint: %shttp://localhost:3000%s\n" "${PRIMARY}" "${NC}"
}

start_server() {
    print_header
    log_info "Starting Confide Server services..."
    cd "$DOCKER_DIR"
    run_step "Starting server services" docker compose up -d --build server server-postgres server-redis
    blank
    log_success "Server services started!"
    printf "  Endpoint: %shttp://localhost:8080%s\n" "${PRIMARY}" "${NC}"
}

reset_server() {
    print_header
    log_info "Resetting Confide Server services..."
    cd "$DOCKER_DIR"
    run_step "Resetting server (force recreate)" docker compose up -d --build --force-recreate server
    blank
    log_success "Server reset complete!"
}

print_endpoints() {
    blank
    hr
    printf "%sEndpoints%s\n" "${BOLD}" "${NC}"
    printf "  %-14s %shttp://localhost:3000%s\n" "Confide-Central:" "${PRIMARY}" "${NC}"
    printf "  %-14s %shttp://localhost:8080%s\n" "Confide-Server:"  "${PRIMARY}" "${NC}"
    hr
    blank
    printf "  %s\n" "./setup-local.sh logs    # view logs"
    printf "  %s\n" "./setup-local.sh client  # run the client"
    blank
}

stop_services() {
    print_header
    log_info "Stopping all services..."
    cd "$DOCKER_DIR"
    run_step "docker compose down" docker compose down
    blank
    log_success "All services stopped"
}

build_images() {
    print_header
    log_info "Building Docker images..."
    cd "$DOCKER_DIR"
    run_step "docker compose build" docker compose build
    blank
    log_success "All images built"
}

rebuild_services() {
    print_header
    log_info "Rebuilding and restarting services..."
    cd "$DOCKER_DIR"
    run_step "Rebuild + restart (force recreate)" docker compose up -d --build --force-recreate
    blank
    log_success "Services rebuilt and restarted"
}

show_logs() {
    print_header
    log_info "Showing logs (Ctrl+C to exit)..."
    blank
    cd "$DOCKER_DIR"
    docker compose logs -f
}

run_client() {
    check_bun

    print_header
    log_info "Installing client dependencies..."
    cd "$CLIENT_DIR"
    run_step "bun install" bun install

    # Find a free port starting from 1420
    local port=1420
    require_cmd lsof
    while lsof -i :"$port" >/dev/null 2>&1; do
        ((port++))
    done

    log_info "Starting client on port $port..."
    PORT=$port bun run tauri dev --config "{\"build\":{\"devUrl\":\"http://localhost:$port\"}}"
}

clean_all() {
    print_header
    log_warn "This will stop all services and delete all Docker volumes!"
    read -r -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ${REPLY:-} =~ ^[Yy]$ ]]; then
        cd "$DOCKER_DIR"
        run_step "docker compose down -v --remove-orphans" docker compose down -v --remove-orphans
        blank
        log_success "All services stopped and volumes removed"
    else
        blank
        log_info "Cancelled."
    fi
}

show_status() {
    print_header
    cd "$DOCKER_DIR"
    docker compose ps
    blank
}

case "${1:-help}" in
    up|start)
        check_docker
        start_services
        ;;
    central)
        check_docker
        start_central
        ;;
    server)
        check_docker
        start_server
        ;;
    reset-server)
        check_docker
        reset_server
        ;;
    down|stop)
        stop_services
        ;;
    build)
        check_docker
        build_images
        ;;
    rebuild)
        check_docker
        rebuild_services
        ;;
    logs)
        show_logs
        ;;
    client)
        run_client
        ;;
    clean)
        clean_all
        ;;
    status|ps)
        show_status
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        log_error "Unknown command: $1"
        print_usage
        exit 1
        ;;
esac
