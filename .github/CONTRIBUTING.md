# Contributing to EyeOnChess

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose)
- [Node.js 22+](https://nodejs.org/) (for running commands outside Docker)
- [pnpm](https://pnpm.io/) (installed automatically via corepack or `curl -fsSL https://get.pnpm.io/install.sh | sh -`)

### Running Locally

```bash
git clone https://github.com/amiwrpremium/eye-on-chess.git
cd eye-on-chess
cp .env.example .env
docker compose -f deployment/docker-compose.dev.yml up --build
```

This starts all services with hot reload:

- **Web:** http://localhost:3000
- **API:** http://localhost:3001
- **Postgres:** localhost:5432
- **Redis:** localhost:6379

### Running Without Docker

```bash
pnpm install
# Start Postgres and Redis separately, then:
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

## Branch Naming

Use the following format for branch names:

| Type     | Format                       | Example                   |
| -------- | ---------------------------- | ------------------------- |
| Feature  | `feature/short-description`  | `feature/tournament-mode` |
| Bug fix  | `fix/short-description`      | `fix/clock-sync-issue`    |
| Docs     | `docs/short-description`     | `docs/api-reference`      |
| Refactor | `refactor/short-description` | `refactor/game-socket`    |

## Pull Request Guidelines

1. **One PR per feature/fix** — Keep PRs focused and reviewable
2. **Write a clear description** — Explain what changed and why
3. **Test your changes** — Make sure `docker compose -f deployment/docker-compose.dev.yml up --build` works
4. **No breaking changes** — If unavoidable, document the migration path
5. **Update documentation** — If your change affects setup, config, or user-facing behavior

### PR Checklist

- [ ] Code compiles without errors
- [ ] All services start with `docker compose -f deployment/docker-compose.dev.yml up --build`
- [ ] New env vars are documented in `.env.example`
- [ ] Database changes use Prisma migrations (never raw SQL)
- [ ] No hardcoded secrets or credentials in source code

## Code Style

### General

- **TypeScript strict mode** everywhere
- Use `const` over `let` where possible
- Prefer early returns over deep nesting
- No `any` types unless absolutely necessary

### Backend (apps/api)

- Fastify route handlers in `src/routes/`
- Shared utilities in `src/lib/`
- Middleware in `src/middleware/`
- All database access through Prisma (no raw SQL)

### Frontend (apps/web)

- Next.js App Router (no pages directory)
- Components in `src/components/`
- Zustand stores in `src/stores/`
- API calls through the shared axios instance (`src/lib/api.ts`)
- Tailwind CSS for styling (no CSS modules)

### Database

- Always use Prisma migrations: `npx prisma migrate dev --name description`
- Never modify existing migrations — create new ones
- Keep schema changes backwards-compatible when possible

## Project Structure

```
apps/web/          Next.js frontend
  src/app/         Pages (App Router)
  src/components/  Reusable UI components
  src/stores/      Zustand state stores
  src/lib/         Utilities (API client, socket)

apps/api/          Fastify backend
  src/routes/      API route handlers
  src/lib/         Utilities (Prisma, Redis, JWT, Stockfish)
  src/middleware/   Request middleware
  prisma/          Schema, migrations, seed

packages/chess/    Shared TypeScript types
deployment/        Dockerfiles, Nginx config
scripts/           Utility scripts (backup, etc.)
```

## Need Help?

- Open an issue with the question label
- Check existing issues and discussions first

Thank you for contributing!
