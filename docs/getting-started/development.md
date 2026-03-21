# Development Setup

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 22+](https://nodejs.org/) (optional, for IDE support)
- [pnpm](https://pnpm.io/) (optional, for local installs)

## Starting the Dev Environment

```bash
git clone https://github.com/amiwrpremium/eye-on-chess.git
cd eye-on-chess
cp .env.example .env
docker compose -f deployment/docker-compose.dev.yml up --build
```

Or with Make:

```bash
make dev          # Foreground (see all logs)
make dev-up       # Background
make dev-logs     # Tail logs
```

## Services

| Service  | URL                   | Notes                           |
| -------- | --------------------- | ------------------------------- |
| Web      | http://localhost:3000 | Next.js with hot reload         |
| API      | http://localhost:3001 | Fastify with tsx watch          |
| Postgres | localhost:5432        | Direct access for tools         |
| Redis    | localhost:6379        | Direct access for tools         |
| Worker   | (no port)             | Stockfish analysis, polls queue |

## Hot Reload

Source files are volume-mounted into Docker containers:

- `apps/api/src/` — API code changes reload via `tsx watch`
- `apps/api/prisma/` — Schema changes are picked up
- `apps/web/src/` — Frontend changes reload via Next.js HMR
- `packages/chess/src/` — Shared types changes propagate

## Local Install (for IDE)

To get TypeScript autocompletion in your editor:

```bash
pnpm install     # or: make install
```

This installs dependencies locally so your IDE can resolve types. The actual code runs in Docker.

## Database Tools

```bash
make db-studio     # Opens Prisma Studio at localhost:5555
make shell-postgres # Opens psql shell
make db-migrate    # Run pending migrations
make db-seed       # Re-run seed script
make db-reset      # Reset DB (destroys all data)
```

## Useful Commands

```bash
make dev-ps         # Show running service status
make dev-logs-api   # Tail API logs only
make dev-logs-web   # Tail web logs only
make dev-logs-worker # Tail worker logs only
make shell-api      # Shell into API container
make shell-web      # Shell into web container
make shell-redis    # Open redis-cli
```

## Creating a Migration

When you change the Prisma schema:

```bash
# From the host (with local pnpm install)
cd apps/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eyeonchess \
  npx prisma migrate dev --name your-migration-name
```

Or from inside the container:

```bash
make shell-api
npx prisma migrate dev --name your-migration-name
```

## Code Style

- TypeScript strict mode everywhere
- Tailwind CSS for styling (no CSS modules)
- Zustand for state management
- Fastify for API routes
- Prisma for database access (no raw SQL)
- All new features must work in Docker Compose
