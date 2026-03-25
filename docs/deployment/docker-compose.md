# Docker Compose

EyeOnChess provides two Docker Compose configurations in the `deployment/` directory.

## Production (`docker-compose.yml`)

```bash
docker compose -f deployment/docker-compose.yml up -d
# or: make up
```

### Services

| Service   | Image                      | Port             | Health Check                        |
| --------- | -------------------------- | ---------------- | ----------------------------------- |
| nginx     | nginx:alpine               | **80** (exposed) | `wget http://localhost/health`      |
| postgres  | postgres:16-alpine         | internal         | `pg_isready -U postgres`            |
| pgbouncer | edoburu/pgbouncer:1.23.1   | internal (6432)  | —                                   |
| redis     | redis:7-alpine             | internal         | `redis-cli ping`                    |
| api       | apps/api/Dockerfile.prod   | internal (3001)  | `wget http://localhost:3001/health` |
| web       | apps/web/Dockerfile        | internal (3000)  | `wget http://localhost:3000`        |
| worker    | apps/api/Dockerfile.worker | none             | —                                   |

### Key Differences from Dev

- Nginx is the single entry point (port 80)
- No ports exposed for postgres, redis, api, or web
- No volume mounts (code baked into images)
- Health checks on all services with dependency ordering
- Production-optimized builds

### Connection Pooling (PgBouncer)

All application database traffic routes through PgBouncer, a lightweight connection pooler sitting between application services and PostgreSQL.

- **Pool mode:** Transaction (connections returned to pool after each transaction)
- **Default pool size:** 20 connections per database
- **Max client connections:** 200
- **Port:** 6432 (internal)

API and worker services connect to `pgbouncer:6432` with `?pgbouncer=true` in the connection string (disables PostgreSQL prepared statements, which are incompatible with transaction pooling).

Migrations, seeds, and bot seeds use `DIRECT_DATABASE_URL` to connect directly to PostgreSQL (DDL statements require a direct connection, not a pooled one).

Configuration files are in `deployment/pgbouncer/`:

- `pgbouncer.ini` — pool settings
- `userlist.txt` — authentication credentials

### Startup Order

1. Postgres + Redis start first
2. Postgres must pass health check before PgBouncer starts
3. PgBouncer starts after Postgres is healthy
4. API runs migrations + seed + bot seed on startup (via direct Postgres connection)
5. Web starts after API
6. Nginx starts after both Web and API are healthy

### Graceful Shutdown

The API server handles `SIGTERM` and `SIGINT` for clean shutdown during `docker stop` or deployments:

1. Stop accepting new connections
2. Wait for in-flight requests to complete
3. Close Socket.io connections
4. Disconnect Prisma (drain DB connection pool)
5. Disconnect Redis
6. Exit

Force exits after 10 seconds if cleanup hangs.

## Development (`docker-compose.dev.yml`)

```bash
docker compose -f deployment/docker-compose.dev.yml up --build
# or: make dev
```

### Services

| Service   | Port                 | Notes                                          |
| --------- | -------------------- | ---------------------------------------------- |
| nginx     | **80** (exposed)     | Reverse proxy — primary entry point            |
| postgres  | **5432** (127.0.0.1) | Direct access for debugging                    |
| pgbouncer | **6432** (127.0.0.1) | Connection pooler                              |
| redis     | **6379** (127.0.0.1) | Direct access for debugging                    |
| api       | **3001** (127.0.0.1) | Hot reload via `tsx watch`                     |
| web       | **3000**             | Hot reload via Next.js HMR (internal to Nginx) |
| worker    | —                    | Hot reload via volume mount                    |

### Volume Mounts

- `apps/api/src/` → `/app/apps/api/src/`
- `apps/api/prisma/` → `/app/apps/api/prisma/`
- `apps/web/src/` → `/app/apps/web/src/`
- `packages/chess/src/` → `/app/packages/chess/src/`

Nginx is included in development on port 80 as the primary entry point (same routing as production). Service ports are also exposed on `127.0.0.1` for direct debugging access.

## Environment Variables

Both compose files read from `../.env` (project root). See [Configuration](../getting-started/configuration.md).

## Volumes

Named volumes persist data across restarts:

| Volume            | Name (prod)                  | Name (dev)              | Purpose                         |
| ----------------- | ---------------------------- | ----------------------- | ------------------------------- |
| `pgdata`          | `eyeonchess-pgdata`          | `eyeonchess-dev-pgdata` | PostgreSQL data                 |
| `prometheus_data` | `eyeonchess-prometheus-data` | —                       | Prometheus metrics              |
| `loki_data`       | `eyeonchess-loki-data`       | —                       | Loki log data                   |
| `grafana_data`    | `eyeonchess-grafana-data`    | —                       | Grafana dashboards and settings |

To destroy all volumes:

```bash
make clean-volumes   # WARNING: destroys all data
```
