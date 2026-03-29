# Configuration

All configuration is done via environment variables in a `.env` file at the project root. Copy `.env.example` to `.env` to get started.

## Required Variables

| Variable              | Description                                                                                            | Default                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string. In Docker, points to PgBouncer for connection pooling.                   | `postgresql://postgres:postgres@postgres:5432/eyeonchess` |
| `DIRECT_DATABASE_URL` | Direct PostgreSQL connection for migrations (bypasses PgBouncer). Set automatically by Docker Compose. | —                                                         |
| `REDIS_URL`           | Redis connection string                                                                                | `redis://redis:6379`                                      |
| `JWT_SECRET`          | Secret for signing JWT tokens. **Must be changed in production.** Generate with `openssl rand -hex 32` | `change-me-to-a-random-secret`                            |

## Environment

| Variable   | Description                                                                                   | Default      |
| ---------- | --------------------------------------------------------------------------------------------- | ------------ |
| `NODE_ENV` | Set to `production` for secure cookies, strict CORS, wss-only WebSocket, and Swagger disabled | `production` |

## API URLs

| Variable                | Description                                                                          | Default            |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| `API_URL`               | Internal Docker network URL (used by server-side code)                               | `http://api:3001`  |
| `NEXT_PUBLIC_API_URL`   | Public API URL (used by the browser, routed through Nginx). **Baked at build time.** | `http://localhost` |
| `ADMIN_URL`             | Admin panel URL (added to CORS allowlist). Defaults to `admin.{SITE_URL domain}`.    | —                  |
| `NEXT_PUBLIC_ADMIN_URL` | Public admin panel URL for the admin app build. **Baked at build time.**             | —                  |
| `NEXT_PUBLIC_SITE_URL`  | Main site URL for the admin app back-to-app link. **Baked at build time.**           | —                  |

## Site Configuration

| Variable    | Description                                                          | Default            |
| ----------- | -------------------------------------------------------------------- | ------------------ |
| `SITE_NAME` | Display name for the platform. Supports white-labeling.              | `EyeOnChess`       |
| `SITE_URL`  | Public URL of the site (used in metadata, links, and CORS whitelist) | `http://localhost` |

> **Note:** `SITE_NAME`, `REGISTRATION_OPEN`, `MAX_USERS`, and `REQUIRE_EMAIL_VERIFICATION` can also be changed at runtime from the [Admin Panel](../admin/settings.md). The env vars serve as initial defaults — database values override them.

## Registration

| Variable                     | Description                                                                                                                             | Default |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `REGISTRATION_OPEN`          | Set to `false` to close new user registrations                                                                                          | `true`  |
| `MAX_USERS`                  | Maximum number of users allowed. `0` = unlimited.                                                                                       | `0`     |
| `REQUIRE_EMAIL_VERIFICATION` | Block unverified users from logging in. Note: no email sending is implemented — verification must be done manually via the admin panel. | `false` |

## Admin Seed User

These variables define the admin user created on first boot.

| Variable             | Description                                       | Default                  |
| -------------------- | ------------------------------------------------- | ------------------------ |
| `SEED_USER_EMAIL`    | Admin email                                       | `admin@eyeonchess.local` |
| `SEED_USER_USERNAME` | Admin username                                    | `admin`                  |
| `SEED_USER_PASSWORD` | Admin password. **Change this before deploying!** | `changeme123`            |

The seed user is created with `role: ADMIN` and `verified: true`.

## SSL (Optional)

| Variable          | Description                                                                             | Default |
| ----------------- | --------------------------------------------------------------------------------------- | ------- |
| `SITE_DOMAIN`     | Domain for automatic HTTPS via Let's Encrypt. Leave empty for HTTP-only.                | (empty) |
| `CERTBOT_EMAIL`   | Email for Let's Encrypt notifications. Required when `SITE_DOMAIN` is set.              | (empty) |
| `CERTBOT_DOMAINS` | Space-separated list of domains for the SSL cert. Defaults to `SITE_DOMAIN` if not set. | (empty) |

See [HTTPS Setup](../deployment/ci-cd.md#https-with-lets-encrypt) and [Cloudflare Setup](../deployment/cloudflare.md) for detailed guides.

## Worker (Stockfish)

| Variable         | Description                                                                 | Default     |
| ---------------- | --------------------------------------------------------------------------- | ----------- |
| `STOCKFISH_PATH` | Path to the Stockfish binary. Auto-detected in the Docker worker container. | `stockfish` |

## YAML Configuration Files

In addition to environment variables, some features are configured via YAML files in `deployment/config/`.

### `deployment/config/rate-limits.yml`

Per-route rate limits are defined in this file. Each route can specify its own `max` (requests) and `timeWindow` values, overriding the global defaults. Changes to this file are picked up automatically via hot-reload — no server restart is required.

### `deployment/config/bots.yml`

Bot personality seed definitions. This is the **seed source only** — the database is the source of truth. The seeder reads this file on startup and creates missing bots, but never overwrites existing ones. Admin edits via the admin panel persist across reseeds. Use `FORCE_RESEED=1` to overwrite all bots from YAML.

## Production Checklist

Before deploying to production, ensure:

1. `JWT_SECRET` is a random 32+ character string
2. `SEED_USER_PASSWORD` is a strong password
3. `NODE_ENV=production` is set
4. `NEXT_PUBLIC_API_URL` points to your public domain
5. `SITE_URL` matches your public URL
6. `ADMIN_URL` points to your admin subdomain (e.g. `https://admin.yourdomain.com`)
7. Consider setting `REGISTRATION_OPEN=false` until ready
