# Configuration

All configuration is done via environment variables in a `.env` file at the project root. Copy `.env.example` to `.env` to get started.

## Required Variables

| Variable       | Description                                                                                            | Default                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                                                                           | `postgresql://postgres:postgres@postgres:5432/eyeonchess` |
| `REDIS_URL`    | Redis connection string                                                                                | `redis://redis:6379`                                      |
| `JWT_SECRET`   | Secret for signing JWT tokens. **Must be changed in production.** Generate with `openssl rand -hex 32` | `change-me-to-a-random-secret`                            |

## Environment

| Variable   | Description                                              | Default       |
| ---------- | -------------------------------------------------------- | ------------- |
| `NODE_ENV` | Set to `production` for secure cookies and optimizations | `development` |

## API URLs

| Variable              | Description                                                             | Default                 |
| --------------------- | ----------------------------------------------------------------------- | ----------------------- |
| `API_URL`             | Internal Docker network URL (used by server-side code)                  | `http://api:3001`       |
| `NEXT_PUBLIC_API_URL` | Public API URL (used by the browser). Set to your domain in production. | `http://localhost:3001` |

## Site Configuration

| Variable    | Description                                             | Default            |
| ----------- | ------------------------------------------------------- | ------------------ |
| `SITE_NAME` | Display name for the platform. Supports white-labeling. | `EyeOnChess`       |
| `SITE_URL`  | Public URL of the site (used in metadata and links)     | `http://localhost` |

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

## Worker (Stockfish)

| Variable         | Description                                                                 | Default     |
| ---------------- | --------------------------------------------------------------------------- | ----------- |
| `STOCKFISH_PATH` | Path to the Stockfish binary. Auto-detected in the Docker worker container. | `stockfish` |

## Production Checklist

Before deploying to production, ensure:

1. `JWT_SECRET` is a random 32+ character string
2. `SEED_USER_PASSWORD` is a strong password
3. `NODE_ENV=production` is set
4. `NEXT_PUBLIC_API_URL` points to your public domain
5. `SITE_URL` matches your public URL
6. Consider setting `REGISTRATION_OPEN=false` until ready
