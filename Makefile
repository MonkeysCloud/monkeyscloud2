# =============================================================================
# MONKEYSCLOUD — Makefile (Developer Commands)
# =============================================================================
# Usage: make <command>
# =============================================================================

.PHONY: help up down build rebuild logs status \
        shell-api shell-db shell-redis shell-dashboard \
        migrate migrate-fresh seed test lint \
        fresh clean minio-setup

.DEFAULT_GOAL := help

# --- Colors ------------------------------------------------------------------
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RESET  := \033[0m

# =============================================================================
# HELP
# =============================================================================

help: ## Show this help
	@echo ""
	@echo "$(CYAN)MonkeysCloud$(RESET) — Local Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# DOCKER COMPOSE
# =============================================================================

up: ## Start all services in background
	@echo "$(CYAN)Starting MonkeysCloud services...$(RESET)"
	docker compose up -d
	@echo "$(GREEN)Services started!$(RESET)"
	@make status

down: ## Stop all services
	@echo "$(YELLOW)Stopping MonkeysCloud services...$(RESET)"
	docker compose down

build: ## Build all images
	docker compose build

rebuild: ## Rebuild all images (no cache)
	docker compose build --no-cache

logs: ## Follow logs from all services
	docker compose logs -f

logs-api: ## Follow API logs
	docker compose logs -f api

logs-dashboard: ## Follow Dashboard logs
	docker compose logs -f dashboard

logs-git: ## Follow Git Server logs
	docker compose logs -f git-server

logs-cicd: ## Follow CI/CD Worker logs
	docker compose logs -f cicd-worker

status: ## Show status of all services
	@echo ""
	@echo "$(CYAN)MonkeysCloud Service Status$(RESET)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "$(GREEN)Dashboard:$(RESET)    http://localhost:3000"
	@echo "$(GREEN)API:$(RESET)          http://localhost:8000"
	@echo "$(GREEN)Git Server:$(RESET)   http://localhost:3001"
	@echo "$(GREEN)Mailpit:$(RESET)      http://localhost:8025"
	@echo "$(GREEN)MinIO:$(RESET)        http://localhost:9001"
	@echo "$(GREEN)MySQL:$(RESET)        localhost:3306"
	@echo "$(GREEN)Redis:$(RESET)        localhost:6379"
	@echo ""

# =============================================================================
# SHELLS
# =============================================================================

shell-api: ## Open shell in API container
	docker compose exec api sh

shell-db: ## Open MySQL shell
	docker compose exec mysql mysql -u root -p$(MYSQL_ROOT_PASSWORD)

shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli

shell-dashboard: ## Open shell in Dashboard container
	docker compose exec dashboard sh

# =============================================================================
# DATABASE
# =============================================================================

migrate: ## Run database migrations
	docker compose exec api php ml migrate

migrate-fresh: ## Drop all tables & re-migrate
	docker compose exec api php ml migrate:fresh

migrate-status: ## Show migration status
	docker compose exec api php ml migrate:status

seed: ## Seed the database
	docker compose exec api php ml seed

# =============================================================================
# TESTING & QUALITY
# =============================================================================

test: ## Run PHP tests
	docker compose exec api vendor/bin/phpunit

test-coverage: ## Run tests with coverage
	docker compose exec api vendor/bin/phpunit --coverage-html var/coverage

lint: ## Run PHP linting
	docker compose exec api vendor/bin/phpcs

lint-fix: ## Auto-fix lint issues
	docker compose exec api vendor/bin/phpcbf

# =============================================================================
# SETUP & MAINTENANCE
# =============================================================================

setup: ## First-time setup (copy env, build, start, migrate, seed)
	@echo "$(CYAN)Setting up MonkeysCloud for the first time...$(RESET)"
	@test -f .env || cp .env.example .env
	@make build
	@make up
	@echo "$(YELLOW)Waiting for MySQL to be ready...$(RESET)"
	@sleep 10
	@make migrate
	@make seed
	@make minio-setup
	@echo ""
	@echo "$(GREEN)✅ MonkeysCloud is ready!$(RESET)"
	@make status

fresh: ## Full reset: stop, remove volumes, rebuild, migrate, seed
	@echo "$(YELLOW)⚠️  This will destroy all local data. Continue? [y/N]$(RESET)"
	@read -r ans && [ "$$ans" = "y" ] || exit 1
	docker compose down -v
	@make build
	@make up
	@sleep 10
	@make migrate
	@make seed
	@make minio-setup
	@echo "$(GREEN)✅ Fresh environment ready!$(RESET)"
	@make status

clean: ## Remove all containers, volumes, networks, and images
	@echo "$(YELLOW)⚠️  This will destroy EVERYTHING. Continue? [y/N]$(RESET)"
	@read -r ans && [ "$$ans" = "y" ] || exit 1
	docker compose down -v --rmi all --remove-orphans

minio-setup: ## Create MinIO buckets
	@echo "$(CYAN)Setting up MinIO buckets...$(RESET)"
	@docker compose exec minio mc alias set local http://localhost:9000 \
		$(MINIO_ROOT_USER) $(MINIO_ROOT_PASSWORD) 2>/dev/null || true
	@docker compose exec minio mc mb local/mc-git-repos --ignore-existing 2>/dev/null || true
	@docker compose exec minio mc mb local/mc-build-artifacts --ignore-existing 2>/dev/null || true
	@docker compose exec minio mc mb local/mc-assets --ignore-existing 2>/dev/null || true
	@docker compose exec minio mc mb local/mc-backups --ignore-existing 2>/dev/null || true
	@echo "$(GREEN)MinIO buckets created$(RESET)"

# =============================================================================
# COMPOSER (API)
# =============================================================================

composer-install: ## Install PHP dependencies
	docker compose exec api composer install

composer-update: ## Update PHP dependencies
	docker compose exec api composer update

composer-require: ## Add a PHP package (usage: make composer-require PKG=vendor/package)
	docker compose exec api composer require $(PKG)

# =============================================================================
# NPM (Dashboard)
# =============================================================================

npm-install: ## Install Node dependencies
	docker compose exec dashboard npm install

npm-add: ## Add a Node package (usage: make npm-add PKG=package-name)
	docker compose exec dashboard npm install $(PKG)
