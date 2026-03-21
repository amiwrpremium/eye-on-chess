# Docker Compose

EyeOnChess provides two Docker Compose configurations in the `deployment/` directory.

## Production (`docker-compose.yml`)

```bash
docker compose -f deployment/docker-compose.yml up -d
# or: make up
```

### Services

| Service  | Image                      | Port             | Health Check                        |
| -------- | -------------------------- | ---------------- | ----------------------------------- |
| nginx    | nginx:alpine               | **80** (exposed) | `wget http://localhost/health`      |
| postgres | postgres:alpine            | internal         | `pg_isready -U postgres`            |
| redis    | redis:alpine               | internal         | `redis-cli ping`                    |
| api      | apps/api/Dockerfile.prod   | internal (3001)  | `wget http://localhost:3001/health` |
| web      | apps/web/Dockerfile        | internal (3000)  | `wget http://localhost:3000`        |
| worker   | apps/api/Dockerfile.worker | none             | —                                   |

### Key Differences from Dev

- Nginx is the single entry point (port 80)
- No ports exposed for postgres, redis, api, or web
- No volume mounts (code baked into images)
- Health checks on all services with dependency ordering
- Production-optimized builds

### Startup Order

1. Postgres + Redis start first
2. Postgres must pass health check before API starts
3. API runs migrations + seed on startup
4. Web starts after API
5. Nginx starts after both Web and API are healthy

## Development (`docker-compose.dev.yml`)

```bash
docker compose -f deployment/docker-compose.dev.yml up --build
# or: make dev
```

### Services

| Service  | Port     | Notes                       |
| -------- | -------- | --------------------------- |
| postgres | **5432** | Direct access               |
| redis    | **6379** | Direct access               |
| api      | **3001** | Hot reload via `tsx watch`  |
| web      | **3000** | Hot reload via Next.js HMR  |
| worker   | —        | Hot reload via volume mount |

### Volume Mounts

- `apps/api/src/` → `/app/apps/api/src/`
- `apps/api/prisma/` → `/app/apps/api/prisma/`
- `apps/web/src/` → `/app/apps/web/src/`
- `packages/chess/src/` → `/app/packages/chess/src/`

No Nginx in development — access services directly by port.

## Environment Variables

Both compose files read from `../.env` (project root). See [Configuration](../getting-started/configuration.md).

## Volumes

A named volume `pgdata` persists PostgreSQL data across restarts. To destroy it:

```bash
make clean-volumes   # WARNING: destroys all data
```
