.PHONY: help build test clean fmt clippy check docker-up docker-down

help:
	@echo "Confide Monorepo - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make dev-central      - Run Central in dev mode"
	@echo "  make dev-server       - Run Server in dev mode"
	@echo "  make dev-client       - Run Client in dev mode"
	@echo "  make dev-all          - Start all services"
	@echo ""
	@echo "Build:"
	@echo "  make build            - Build all Rust projects"
	@echo "  make build-central    - Build Central only"
	@echo "  make build-server     - Build Server only"
	@echo "  make build-client     - Build Client only"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run all tests"
	@echo "  make test-central     - Test Central"
	@echo "  make test-server      - Test Server"
	@echo ""
	@echo "Quality:"
	@echo "  make fmt              - Format Rust code"
	@echo "  make clippy           - Run clippy"
	@echo "  make check            - Run fmt + clippy + test"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-up        - Start dev environment"
	@echo "  make docker-down      - Stop all services"
	@echo "  make docker-logs      - Show logs"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            - Clean artifacts"
	@echo ""

dev-central:
	RUST_LOG=debug cargo run --package confide-central

dev-server:
	RUST_LOG=debug cargo run --package confide-server

dev-client:
	cd apps/client && bun run tauri dev

dev-all:
	./infrastructure/scripts/setup-local.sh up &
	sleep 5
	$(MAKE) dev-client

build:
	cargo build --release --workspace

build-central:
	cargo build --release --package confide-central

build-server:
	cargo build --release --package confide-server

build-client:
	cd apps/client && bun run tauri build

test:
	cargo test --workspace

test-central:
	cargo test --package confide-central

test-server:
	cargo test --package confide-server

fmt:
	cargo fmt --all

clippy:
	cargo clippy --all-targets --all-features -- -D warnings

check: fmt clippy test
	@echo "All checks passed!"

docker-build:
	docker compose -f infrastructure/docker/docker-compose.yml build

docker-up:
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker-down:
	docker compose -f infrastructure/docker/docker-compose.yml down

docker-logs:
	docker compose -f infrastructure/docker/docker-compose.yml logs -f

clean:
	cargo clean
	rm -rf target/
	rm -rf apps/client/dist/
	rm -rf apps/client/src-tauri/target/
