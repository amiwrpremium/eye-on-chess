# Dockerfiles

All Dockerfiles are co-located with their respective apps.

## `apps/web/Dockerfile` (Development)

- **Base:** `node:22-alpine`
- **Features:** Installs pnpm, copies lockfile, installs deps, copies source
- **CMD:** `pnpm --filter @eyeonchess/web dev` (Next.js dev server on 0.0.0.0:3000)
- **Used by:** Both dev and production compose (production uses the dev server for now — see Dockerfile.prod for future standalone builds)

## `apps/web/Dockerfile.prod` (Production)

- **Base:** `node:22-alpine` (multi-stage)
- **Stages:** deps → builder → runner
- **Features:** Next.js standalone output mode for minimal production image
- **CMD:** `node apps/web/server.js`

> **Note:** To use the production Dockerfile, enable `output: 'standalone'` in `next.config.js`.

## `apps/api/Dockerfile` (Development)

- **Base:** `node:22-alpine`
- **Features:** Installs pnpm, copies lockfile, installs deps, generates Prisma client
- **CMD:** Runs migrations → seed → `tsx watch` (hot reload)
- **Startup sequence:**
  1. `prisma migrate deploy` — applies pending migrations
  2. `prisma db seed` — creates admin user (idempotent upsert)
  3. `tsx watch src/server.ts` — starts Fastify with file watching

## `apps/api/Dockerfile.prod` (Production)

- **Base:** `node:22-alpine` (multi-stage)
- **Stages:** deps → runner
- **CMD:** Same startup sequence as dev (migrate → seed → dev)

## `apps/api/Dockerfile.worker` (Analysis Worker)

- **Base:** `node:22-bookworm-slim` (Debian, not Alpine)
- **Why Debian?** Stockfish is not available in Alpine's package repository
- **Installs:** `stockfish`, `openssl` (for Prisma), pnpm
- **PATH:** `/usr/games` added for stockfish binary
- **CMD:** `pnpm --filter @eyeonchess/api worker` (runs `src/worker.ts`)

## Build Context

All Dockerfiles use the project root (`..`) as the build context, since they need access to:

- `pnpm-lock.yaml` and `pnpm-workspace.yaml` (root)
- `package.json` and `turbo.json` (root)
- `packages/chess/` (shared dependency)
