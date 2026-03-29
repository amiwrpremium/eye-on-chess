# Docker Compose

EyeOnChess provides three Docker Compose configurations in the `deployment/` directory.

## Production — Local Build (`docker-compose.yml`)

Builds images from source on the server. Use this when not using the CI/CD pipeline.

```bash
docker compose --env-file .env -f deployment/docker-compose.yml up -d
# or: make up
```

### Services

| Service    | Image                         | Port               | Health Check                        |
| ---------- | ----------------------------- | ------------------ | ----------------------------------- |
| nginx      | nginx:alpine                  | **80, 443** (host) | `wget http://localhost/health`      |
| certbot    | certbot/certbot:latest        | —                  | —                                   |
| postgres   | postgres:16-alpine            | internal           | `pg_isready -U postgres`            |
| pgbouncer  | edoburu/pgbouncer:v1.23.1-p2  | internal (6432)    | `pg_isready -h localhost -p 6432`   |
| redis      | redis:7-alpine                | internal           | `redis-cli ping`                    |
| migrate    | Built from Dockerfile.migrate | —                  | — (runs once, exits)                |
| api        | Built from Dockerfile.prod    | internal (3001)    | `wget http://localhost:3001/health` |
| web        | Built from Dockerfile.prod    | internal (3000)    | `wget http://localhost:3000`        |
| admin      | Built from admin/Dockerfile   | internal (3002)    | `wget http://localhost:3002`        |
| worker     | Built from Dockerfile.worker  | —                  | —                                   |
| prometheus | prom/prometheus:v3.4.1        | internal (9090)    | —                                   |
| loki       | grafana/loki:3.5.0            | internal (3100)    | —                                   |
| promtail   | grafana/promtail:3.5.0        | internal           | —                                   |
| grafana    | grafana/grafana:11.6.0        | internal (3000)    | —                                   |

### Key Points

- Nginx is the single entry point (ports 80 and 443)
- No internal service ports exposed to the host
- Images are built locally from Dockerfiles (not pulled from a registry)
- Health checks on postgres, redis, api, web, and nginx with dependency ordering
- Certbot container handles SSL — see [HTTPS Setup](ci-cd.md#https-with-lets-encrypt)

## Production — CD Pipeline (`docker-compose.cd.yml`)

Pulls pre-built images from a container registry (GHCR or GitLab). Used by the CI/CD pipeline and `make deploy`.

```bash
IMAGE_TAG=1.2.0 docker compose --env-file .env -f deployment/docker-compose.cd.yml up -d
# or: IMAGE_TAG=1.2.0 make deploy
```

### Differences from Local Build

| Aspect           | `docker-compose.yml`    | `docker-compose.cd.yml`                                             |
| ---------------- | ----------------------- | ------------------------------------------------------------------- |
| App images       | Built from Dockerfiles  | Pulled from registry (`${IMAGE_REGISTRY}/api:${IMAGE_TAG}`)         |
| Image versioning | None (always `:latest`) | Tagged by version (`1.2.0`) and `:latest`                           |
| Build step       | `make build` required   | `docker compose pull` only                                          |
| Default registry | N/A                     | `ghcr.io/amiwrpremium/eye-on-chess` (override via `IMAGE_REGISTRY`) |
| Rollback         | Requires `git checkout` | `IMAGE_TAG=<old-version> make rollback`                             |

The `IMAGE_REGISTRY` variable defaults to GHCR. Override it for GitLab:

```bash
# In .env
IMAGE_REGISTRY=registry.gitlab.com/your-username/eye-on-chess
```

Infrastructure services (postgres, redis, nginx, certbot, observability) are identical in both compose files.

## Development (`docker-compose.dev.yml`)

```bash
docker compose --env-file .env -f deployment/docker-compose.dev.yml up --build
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
| admin     | **3002** (127.0.0.1) | Hot reload via Next.js HMR (internal to Nginx) |
| worker    | —                    | Hot reload via volume mount                    |

### Volume Mounts

Source directories are mounted into containers for hot reload:

- `apps/api/src/` → `/app/apps/api/src/`
- `apps/api/prisma/` → `/app/apps/api/prisma/`
- `apps/web/src/` → `/app/apps/web/src/`
- `apps/admin/src/` → `/app/apps/admin/src/`
- `packages/chess/src/` → `/app/packages/chess/src/`

Nginx is included in development on port 80 as the primary entry point (same routing as production). Service ports are also exposed on `127.0.0.1` for direct debugging access.

No Certbot or SSL in development — always HTTP.

## Connection Pooling (PgBouncer)

All application database traffic routes through PgBouncer, a lightweight connection pooler sitting between application services and PostgreSQL.

- **Pool mode:** Transaction (connections returned to pool after each transaction)
- **Default pool size:** 20 connections per database
- **Max client connections:** 200
- **Port:** 6432 (internal)

API and worker services connect to `pgbouncer:6432` with `?pgbouncer=true` in the connection string (disables PostgreSQL prepared statements, which are incompatible with transaction pooling).

Migrations, seeds, and bot seeds use `DIRECT_DATABASE_URL` to connect directly to PostgreSQL (DDL statements require a direct connection, not a pooled one).

Configuration files are in `deployment/pgbouncer/`:

- `pgbouncer.ini` — pool settings
- `userlist.txt` — placeholder; actual credentials generated at container startup from `$POSTGRES_PASSWORD`

## Startup Order

1. Postgres + Redis start first (both have health checks)
2. Postgres must pass health check (with 10s start period) before PgBouncer starts
3. PgBouncer starts after Postgres is healthy, has its own health check
4. **Migrate** container runs after PgBouncer + Redis healthy: migrations → seed → bot seed → exits
5. API + Worker start after migrate completes successfully
6. Web starts after API is healthy
7. Nginx starts after both Web and API are healthy
8. Certbot starts after Nginx (needs port 80 for ACME challenge, exits cleanly if no SITE_DOMAIN)

## Graceful Shutdown

The API server handles `SIGTERM` and `SIGINT` for clean shutdown during `docker stop` or deployments:

1. Stop accepting new connections
2. Wait for in-flight requests to complete
3. Close Socket.IO connections
4. Disconnect Prisma (drain DB connection pool)
5. Disconnect Redis
6. Exit

Force exits after 10 seconds if cleanup hangs.

## Environment Variables

All compose files use `--env-file .env` (project root) for variable interpolation. The `.env` file contains database passwords, Redis password, JWT secret, site configuration, and SSL settings.

See [Configuration](../getting-started/configuration.md) for the full reference. See [CI/CD](ci-cd.md) for deployment-specific variables.

## Volumes

Named volumes persist data across restarts:

| Volume            | Name (prod/CD)               | Name (dev)              | Purpose                             |
| ----------------- | ---------------------------- | ----------------------- | ----------------------------------- |
| `pgdata`          | `eyeonchess-pgdata`          | `eyeonchess-dev-pgdata` | PostgreSQL data                     |
| `redis_data`      | `eyeonchess-redis-data`      | —                       | Redis AOF persistence (game clocks) |
| `prometheus_data` | `eyeonchess-prometheus-data` | —                       | Prometheus metrics                  |
| `loki_data`       | `eyeonchess-loki-data`       | —                       | Loki log data                       |
| `grafana_data`    | `eyeonchess-grafana-data`    | —                       | Grafana dashboards and settings     |
| `certbot-certs`   | `eyeonchess-certbot-certs`   | —                       | Let's Encrypt certificates          |
| `certbot-webroot` | `eyeonchess-certbot-webroot` | —                       | ACME challenge webroot              |

To destroy all volumes:

```bash
make clean-volumes   # WARNING: destroys all data including SSL certs
```
