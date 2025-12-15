#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$MONOREPO_ROOT/infrastructure/docker"
CLIENT_DIR="$MONOREPO_ROOT/apps/client"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    log_success "Docker is running"
}

check_bun() {
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Please install Bun first: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    log_success "Bun is installed: $(bun --version)"
}

print_usage() {
    echo ""
    echo "========================================="
    echo "  Confide Local Development Setup"
    echo "========================================="
    echo ""
    echo "Usage: ./setup-local.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up            - Start all services (Central + Server)"
    echo "  central       - Start Central services only"
    echo "  server        - Start Server services only"
    echo "  reset-server  - Rebuild and restart Server services only"
    echo "  down          - Stop all services"
    echo "  build         - Build Docker images"
    echo "  rebuild       - Rebuild and restart services"
    echo "  logs          - Show logs from all services"
    echo "  client        - Run the client (bun run tauri dev)"
    echo "  clean         - Stop services and remove volumes"
    echo "  status        - Show status of services"
    echo "  help          - Show this message"
    echo ""
}

start_services() {
    log_info "Starting ALL Confide services..."

    cd "$DOCKER_DIR"
    docker compose up -d --build

    echo ""
    log_success "All services started!"
    print_endpoints
}

start_central() {
    log_info "Starting Confide Central services..."

    cd "$DOCKER_DIR"
    docker compose up -d --build central central-postgres central-redis

    echo ""
    log_success "Central services started!"
    echo "Endpoint: http://localhost:3000"
}

start_server() {
    log_info "Starting Confide Server services..."

    cd "$DOCKER_DIR"
    docker compose up -d --build server server-postgres server-redis

    echo ""
    log_success "Server services started!"
    echo "Endpoint: http://localhost:8080"
}

reset_server() {
    log_info "Resetting Confide Server services..."

    cd "$DOCKER_DIR"
    docker compose up -d --build --force-recreate server

    echo ""
    log_success "Server reset complete!"
}

print_endpoints() {
    echo ""
    echo "Endpoints:"
    echo "  Confide-Central: http://localhost:3000"
    echo "  Confide-Server:  http://localhost:8080"
    echo ""
    echo "Run './setup-local.sh logs' to view logs"
    echo "Run './setup-local.sh client' to start the client"
    echo ""
}

stop_services() {
    log_info "Stopping all services..."

    cd "$DOCKER_DIR"
    docker compose down

    log_success "All services stopped"
}

build_images() {
    log_info "Building Docker images..."

    cd "$DOCKER_DIR"
    docker compose build

    log_success "All images built"
}

rebuild_services() {
    log_info "Rebuilding and restarting services..."

    cd "$DOCKER_DIR"
    docker compose up -d --build --force-recreate

    log_success "Services rebuilt and restarted"
}

show_logs() {
    log_info "Showing logs (Ctrl+C to exit)..."
    echo ""

    cd "$DOCKER_DIR"
    docker compose logs -f
}

run_client() {
    check_bun

    log_info "Installing client dependencies..."
    cd "$CLIENT_DIR"
    bun install

    # Find a free port starting from 1420
    local port=1420
    while lsof -i :$port >/dev/null; do
        ((port++))
    done

    log_info "Starting client on port $port..."
    PORT=$port bun run tauri dev --config "{\"build\":{\"devUrl\":\"http://localhost:$port\"}}"
}

clean_all() {
    log_warn "This will stop all services and delete all Docker volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$DOCKER_DIR"
        docker compose down -v --remove-orphans

        log_success "All services stopped and volumes removed"
    fi
}

show_status() {
    echo ""
    echo "=== Confide Monorepo Services ==="
    cd "$DOCKER_DIR"
    docker compose ps
    echo ""
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
