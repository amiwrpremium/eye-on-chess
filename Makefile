.PHONY: help up down build logs restart ps \
       deploy deploy-all rollback \
       dev dev-up dev-down dev-build dev-logs dev-restart dev-ps \
       logs-api logs-web logs-worker logs-postgres logs-redis \
       dev-logs-api dev-logs-web dev-logs-worker dev-logs-postgres dev-logs-redis \
       db-migrate db-seed seed-demo seed-bots db-studio db-reset \
       backup restore \
       clean clean-volumes clean-all \
       test test-api test-web test-chess test-coverage test-watch \
       lint lint-fix format format-check \
       install shell-api shell-web shell-worker shell-postgres shell-redis

# ── Config ───────────────────────────────────────────────
PROD_COMPOSE = docker compose --env-file .env -f deployment/docker-compose.yml
DEV_COMPOSE  = docker compose --env-file .env -f deployment/docker-compose.dev.yml

# ── Help ─────────────────────────────────────────────────
help: ## Show this help
	@echo ""
	@echo "EyeOnChess — Makefile Commands"
	@echo ""
	@echo "Production:"
	@grep -E '^(up|down|build|logs|restart|ps|logs-[a-z]+):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "CD Deployment:"
	@grep -E '^(deploy|rollback)[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Development:"
	@grep -E '^dev[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Database:"
	@grep -E '^db-[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Testing:"
	@grep -E '^test[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Linting & Formatting:"
	@grep -E '^(lint|format)[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Utilities:"
	@grep -E '^(backup|restore|clean|install|shell|help)[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Production ───────────────────────────────────────────
up: build-base ## Start production (Nginx on port 80)
	$(PROD_COMPOSE) up -d

down: ## Stop production
	$(PROD_COMPOSE) down

build-base: ## Build the shared base Docker image
	docker build -f deployment/Dockerfile.base -t eyeonchess-base .

build: build-base ## Build all production images
	$(PROD_COMPOSE) build

logs: ## Tail all production logs
	$(PROD_COMPOSE) logs -f

restart: ## Restart all production services
	$(PROD_COMPOSE) restart

ps: ## Show production service status
	$(PROD_COMPOSE) ps

logs-api: ## Tail production API logs
	$(PROD_COMPOSE) logs -f api

logs-web: ## Tail production web logs
	$(PROD_COMPOSE) logs -f web

logs-worker: ## Tail production worker logs
	$(PROD_COMPOSE) logs -f worker

logs-postgres: ## Tail production Postgres logs
	$(PROD_COMPOSE) logs -f postgres

logs-redis: ## Tail production Redis logs
	$(PROD_COMPOSE) logs -f redis

# ── CD Deployment ────────────────────────────────────────
CD_COMPOSE = docker compose --env-file .env -f deployment/docker-compose.cd.yml

deploy: ## Deploy from GHCR images (usage: IMAGE_TAG=1.2.0 make deploy)
	$(CD_COMPOSE) pull api web worker
	$(CD_COMPOSE) up -d --no-deps api
	@echo "Waiting for API health..."
	@sleep 10
	$(CD_COMPOSE) up -d --no-deps web
	@sleep 5
	$(CD_COMPOSE) up -d --no-deps worker
	@echo "Deployment complete. Verifying health..."
	@for i in $$(seq 1 20); do \
		if curl -sf http://localhost/health > /dev/null 2>&1; then \
			echo "Healthy!"; exit 0; \
		fi; \
		echo "Waiting... ($$i/20)"; sleep 3; \
	done; echo "Health check failed" && exit 1

deploy-all: ## Deploy all services from GHCR images (including infra)
	$(CD_COMPOSE) pull
	$(CD_COMPOSE) up -d

rollback: ## Rollback to a specific version (usage: make rollback IMAGE_TAG=1.1.5)
	@test -n "$(IMAGE_TAG)" || (echo "Usage: make rollback IMAGE_TAG=1.1.5" && exit 1)
	IMAGE_TAG=$(IMAGE_TAG) $(CD_COMPOSE) pull api web worker
	IMAGE_TAG=$(IMAGE_TAG) $(CD_COMPOSE) up -d

# ── Development ──────────────────────────────────────────
dev: build-base ## Start development (hot reload, Nginx on port 80)
	$(DEV_COMPOSE) up --build

dev-up: build-base ## Start development in background
	$(DEV_COMPOSE) up --build -d

dev-down: ## Stop development
	$(DEV_COMPOSE) down

dev-build: ## Build development images
	$(DEV_COMPOSE) build

dev-logs: ## Tail all development logs
	$(DEV_COMPOSE) logs -f

dev-restart: ## Restart all development services
	$(DEV_COMPOSE) restart

dev-ps: ## Show development service status
	$(DEV_COMPOSE) ps

dev-logs-api: ## Tail dev API logs
	$(DEV_COMPOSE) logs -f api

dev-logs-web: ## Tail dev web logs
	$(DEV_COMPOSE) logs -f web

dev-logs-worker: ## Tail dev worker logs
	$(DEV_COMPOSE) logs -f worker

dev-logs-postgres: ## Tail dev Postgres logs
	$(DEV_COMPOSE) logs -f postgres

dev-logs-redis: ## Tail dev Redis logs
	$(DEV_COMPOSE) logs -f redis

# ── Database ─────────────────────────────────────────────
db-migrate: ## Run Prisma migrations (dev compose)
	$(DEV_COMPOSE) exec api pnpm --filter @eyeonchess/api run db:migrate

db-seed: ## Run database seed (dev compose)
	$(DEV_COMPOSE) exec api pnpm --filter @eyeonchess/api run db:seed

seed-demo: ## Populate DB with demo data (10 users, friendships, games, collection)
	$(DEV_COMPOSE) exec api pnpm --filter @eyeonchess/api run db:seed-demo

seed-bots: ## Seed/reseed bot personalities from shared definitions
	$(DEV_COMPOSE) exec api pnpm --filter @eyeonchess/api run db:seed-bots

db-studio: ## Open Prisma Studio (requires: make dev-up)
	DATABASE_URL=postgresql://postgres:$${POSTGRES_PASSWORD}@localhost:5432/eyeonchess pnpm --filter @eyeonchess/api exec prisma studio

db-reset: ## Reset database (WARNING: destroys all data)
	@echo "This will destroy all data. Press Ctrl+C to cancel."
	@sleep 3
	$(DEV_COMPOSE) down -v
	$(DEV_COMPOSE) up --build -d

# ── Backup & Restore ────────────────────────────────────
backup: ## Backup production database to ./backups/
	./scripts/backup.sh

restore: ## Restore database (usage: make restore FILE=backups/eyeonchess_XXXX.sql.gz)
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=backups/eyeonchess_XXXX.sql.gz" && exit 1)
	gunzip -c $(FILE) | $(PROD_COMPOSE) exec -T postgres psql -U postgres eyeonchess

# ── Cleanup ──────────────────────────────────────────────
clean: ## Stop all services and remove containers
	$(PROD_COMPOSE) down 2>/dev/null || true
	$(DEV_COMPOSE) down 2>/dev/null || true

clean-volumes: ## Stop all and remove volumes (WARNING: destroys data)
	@echo "This will destroy all data. Press Ctrl+C to cancel."
	@sleep 3
	$(PROD_COMPOSE) down -v 2>/dev/null || true
	$(DEV_COMPOSE) down -v 2>/dev/null || true

clean-all: ## Remove everything: containers, volumes, images
	@echo "This will remove all EyeOnChess containers, volumes, and images."
	@sleep 3
	$(PROD_COMPOSE) down -v --rmi all 2>/dev/null || true
	$(DEV_COMPOSE) down -v --rmi all 2>/dev/null || true

# ── Testing ──────────────────────────────────────────────
test: ## Run all tests
	pnpm test

test-api: ## Run API tests only
	pnpm --filter @eyeonchess/api test

test-web: ## Run web tests only
	pnpm --filter @eyeonchess/web test

test-chess: ## Run shared chess package tests
	pnpm --filter @eyeonchess/chess test

test-coverage: ## Run all tests with coverage
	pnpm test:coverage

test-watch: ## Run tests in watch mode
	pnpm --filter @eyeonchess/api test:watch

# ── Linting & Formatting ─────────────────────────────────
lint: ## Run all linters (TypeScript + ESLint)
	pnpm lint
	pnpm lint:eslint

lint-fix: ## Auto-fix ESLint issues
	pnpm lint:eslint:fix

format: ## Format all files with Prettier
	pnpm format

format-check: ## Check formatting without changes
	pnpm format:check

changelog: ## Generate CHANGELOG.md from conventional commits
	pnpm changelog

# ── Utilities ────────────────────────────────────────────
install: ## Install dependencies locally (for IDE support)
	pnpm install

shell-api: ## Open shell in API container
	$(DEV_COMPOSE) exec api sh

shell-web: ## Open shell in web container
	$(DEV_COMPOSE) exec web sh

shell-worker: ## Open shell in worker container
	$(DEV_COMPOSE) exec worker sh

shell-postgres: ## Open psql in Postgres container
	$(DEV_COMPOSE) exec postgres psql -U postgres eyeonchess

shell-redis: ## Open redis-cli in Redis container
	$(DEV_COMPOSE) exec redis redis-cli -a $${REDIS_PASSWORD}
