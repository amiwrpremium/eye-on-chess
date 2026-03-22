<p align="center">
  <img src="logo.png" alt="EyeOnChess" width="200">
</p>
<h1 align="center">EyeOnChess</h1>
<p align="center">A fully self-hostable, open source chess platform.<br/>Play, analyze, and compete — on your own server.</p>

<p align="center">
  <a href="https://github.com/amiwrpremium/eye-on-chess/actions/workflows/ci.yml"><img src="https://github.com/amiwrpremium/eye-on-chess/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <a href="https://github.com/amiwrpremium/eye-on-chess/stargazers"><img src="https://img.shields.io/github/stars/amiwrpremium/eye-on-chess?style=social" alt="Stars"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js 14">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3">
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify 5">
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma 6">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white" alt="Socket.io 4">
  <img src="https://img.shields.io/badge/Stockfish-15-5C9E31" alt="Stockfish 15">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Nginx-Alpine-009639?logo=nginx&logoColor=white" alt="Nginx">
  <img src="https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js&logoColor=white" alt="Node.js 22">
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white" alt="pnpm 10">
  <img src="https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white" alt="Turborepo">
  <img src="https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white" alt="Vitest 4">
  <img src="https://img.shields.io/badge/ESLint-9-4B32C3?logo=eslint&logoColor=white" alt="ESLint 9">
  <img src="https://img.shields.io/badge/Prettier-3-F7B93E?logo=prettier&logoColor=black" alt="Prettier 3">
  <img src="https://img.shields.io/badge/Pino-10-687634" alt="Pino 10">
  <img src="https://img.shields.io/badge/Zustand-5-764ABC" alt="Zustand 5">
  <img src="https://img.shields.io/badge/chess.js-1.4-green" alt="chess.js">
  <img src="https://img.shields.io/badge/Chessground-9-B58863" alt="Chessground">
  <img src="https://img.shields.io/badge/Grafana-11-F46800?logo=grafana&logoColor=white" alt="Grafana 11">
  <img src="https://img.shields.io/badge/Prometheus-3-E6522C?logo=prometheus&logoColor=white" alt="Prometheus 3">
  <img src="https://img.shields.io/badge/Loki-3-F7D02C?logo=grafana&logoColor=black" alt="Loki 3">
  <img src="https://img.shields.io/badge/Promtail-3-F7D02C" alt="Promtail 3">
</p>

---

## Features

**Game Play**

- Real-time multiplayer via Socket.io
- Challenge friends directly
- Play vs Bot with adjustable Elo (200-3200) using Stockfish WASM
- Game mode presets: Challenge (no help), Friendly (hints + takebacks), Assisted (all tools), Custom
- Time controls: Bullet, Blitz, Rapid, Classical, Unlimited, or custom
- Elo rating system (K=32) with automatic updates
- Draw offers, resignation, timeout detection
- Rematch system after game ends
- Emoji reactions during live games (6 chess-themed reactions)
- Move feedback and classification during bot games
- PGN export (copy to clipboard + .pgn file download)
- Game notes (per-game annotations, auto-saved)
- Sound effects on moves, captures, check, and game events

**Post-Game Analysis**

- Stockfish-powered analysis (depth 18) on every position
- Move classifications: Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder
- Per-player accuracy percentage
- Interactive evaluation graph
- Best move arrows for mistakes
- Opening recognition (ECO codes)

**Personal Stats**

- Rating history chart
- Win/loss/draw record (overall, vs humans, vs bots)
- Top openings with win rates
- Accuracy tracking (average, best, worst game)
- Win/loss streaks
- 30-day activity chart

**Social**

- Friend system with online presence indicators
- User profiles with game statistics (wins/losses/draws)
- User search
- Activity feed showing recent games, analyses, and new friends
- Keyboard shortcuts throughout the app

**Collections**

- Organize games into named collections
- Add/remove games from collections
- Browse collection contents

**Invite System**

- Invite-only registration with invite codes
- Quota system: 10 invites per batch, 75% usage unlocks next batch
- Admin can generate invites

**PWA & Offline**

- Progressive Web App — installable on mobile and desktop
- Offline bot play with Stockfish WASM (same behavior as online)
- Offline games sync to server when connection resumes

**Customization**

- Dark / light mode
- 6 board themes: Classic, Wood, Green, Blue, Purple, Dark
- 3 piece styles: Classic, Modern, Minimal
- Sound toggle
- Settings saved to your profile (synced across devices)
- White-label support (custom site name and URL)

**Self-Hosting**

- Single command deploy: `docker compose up`
- No external services or third-party APIs
- PostgreSQL, Redis, and the app all included
- Nginx reverse proxy with WebSocket support
- Automatic database migrations on startup
- Database backup script with rotation
- Configurable registration (open/closed, user limits)
- YAML-configurable rate limiting with hot-reload (no restart needed)
- Request logging with sensitive field redaction
- Terms of Service / Privacy Policy gate (users must accept)
- Conventional commits enforced via git hooks

## Quick Start

```bash
git clone https://github.com/amiwrpremium/eye-on-chess.git
cd eye-on-chess
cp .env.example .env
# Edit .env — at minimum, change JWT_SECRET and SEED_USER_PASSWORD
docker compose -f deployment/docker-compose.yml up -d
```

Open **http://localhost** and log in with the admin credentials from your `.env`.

### Development

```bash
docker compose -f deployment/docker-compose.dev.yml up --build
```

All traffic goes through Nginx on **http://localhost** (port 80). No other ports are exposed.

Source files are volume-mounted — changes hot-reload automatically.

## Configuration

All configuration is done via environment variables in `.env`. See [`.env.example`](.env.example) for a fully documented template.

### Required

| Variable       | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string                                 |
| `REDIS_URL`    | Redis connection string                                      |
| `JWT_SECRET`   | Secret for JWT signing. Generate with `openssl rand -hex 32` |

### Site

| Variable              | Default            | Description                            |
| --------------------- | ------------------ | -------------------------------------- |
| `SITE_NAME`           | `EyeOnChess`       | Display name (white-label)             |
| `SITE_URL`            | `http://localhost` | Public URL                             |
| `NEXT_PUBLIC_API_URL` | `http://localhost` | Public URL (routed through Nginx)      |
| `API_URL`             | `http://api:3001`  | Internal API URL (Docker network)      |
| `NODE_ENV`            | `development`      | Set to `production` for secure cookies |

### Registration

| Variable                     | Default | Description                            |
| ---------------------------- | ------- | -------------------------------------- |
| `REGISTRATION_OPEN`          | `true`  | Set `false` to close registrations     |
| `MAX_USERS`                  | `0`     | Max users allowed (0 = unlimited)      |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Block unverified users from logging in |

### Admin Seed

| Variable             | Default                  | Description                       |
| -------------------- | ------------------------ | --------------------------------- |
| `SEED_USER_EMAIL`    | `admin@eyeonchess.local` | Admin email                       |
| `SEED_USER_USERNAME` | `admin`                  | Admin username                    |
| `SEED_USER_PASSWORD` | `changeme123`            | Admin password — **change this!** |

### Worker

| Variable         | Default     | Description              |
| ---------------- | ----------- | ------------------------ |
| `STOCKFISH_PATH` | `stockfish` | Path to Stockfish binary |

### Observability (Grafana)

| Variable                 | Default | Description            |
| ------------------------ | ------- | ---------------------- |
| `GRAFANA_ADMIN_USER`     | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |
| `GRAFANA_PORT`           | `3003`  | Grafana UI port        |

## Architecture

```
apps/web        → Next.js 14 frontend (TypeScript, Tailwind CSS)
apps/api        → Fastify backend (TypeScript, Prisma, Socket.io)
packages/chess  → Shared types, constants, helpers (game, time control, openings, etc.)
deployment/     → Dockerfiles, Docker Compose files, Nginx config
scripts/        → Backup utilities
```

### Services

| Service        | Role                                                       |
| -------------- | ---------------------------------------------------------- |
| **Nginx**      | Reverse proxy (port 80), routes /api and /socket.io to API |
| **Web**        | Next.js frontend                                           |
| **API**        | Fastify REST API + Socket.io for real-time                 |
| **Worker**     | Stockfish analysis pipeline (polls Redis queue)            |
| **Postgres**   | Primary database (Prisma ORM)                              |
| **Redis**      | Presence, game clocks, analysis job queue                  |
| **Prometheus** | Metrics collection (scrapes API /metrics every 15s)        |
| **Loki**       | Log aggregation                                            |
| **Promtail**   | Ships Docker container logs to Loki                        |
| **Grafana**    | Dashboards and log viewer (port 3003)                      |

## Tech Stack

| Layer         | Technology                                                 |
| ------------- | ---------------------------------------------------------- |
| Frontend      | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| Board UI      | Chessground                                                |
| Chess Logic   | chess.js                                                   |
| Backend       | Fastify, TypeScript                                        |
| Database      | PostgreSQL, Prisma ORM                                     |
| Real-time     | Socket.io                                                  |
| Cache         | Redis                                                      |
| Analysis      | Stockfish 15                                               |
| Auth          | Custom JWT (access token + httpOnly refresh cookie)        |
| Observability | Grafana 11, Prometheus 3, Loki 3, Promtail 3               |
| Deployment    | Docker Compose, Nginx                                      |

## Backup & Restore

```bash
# Backup
./scripts/backup.sh

# Restore
gunzip -c backups/eyeonchess_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f deployment/docker-compose.yml exec -T postgres psql -U postgres eyeonchess
```

Backups are saved to `./backups/` with automatic rotation (keeps last 7).

## Documentation

Full documentation is in the [`docs/`](docs/index.md) directory:

- [Quick Start](docs/getting-started/quick-start.md)
- [Configuration Reference](docs/getting-started/configuration.md)
- [Architecture Overview](docs/architecture/overview.md)
- [API Reference](docs/api/index.md)
- [Frontend Guide](docs/frontend/index.md)
- [Admin Panel](docs/admin/overview.md)
- [Database Schema](docs/database/schema.md)
- [Deployment Guide](docs/deployment/index.md)

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter api test
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for:

- How to run locally
- Branch naming conventions
- PR guidelines
- Code style notes

## Acknowledgments

- **[Stockfish](https://stockfishchess.org/)** — The powerful open source chess engine used for game analysis and bot play. Stockfish is licensed under the [GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.en.html). We are grateful to the Stockfish team and contributors for making this incredible engine freely available.
- **[chess.js](https://github.com/jhlywa/chess.js)** — Chess move generation, validation, and FEN/PGN parsing.
- **[Chessground](https://github.com/lichess-org/chessground)** — The interactive chessboard UI library, originally built for [Lichess](https://lichess.org/).
- **[Lichess](https://lichess.org/)** — Inspiration for many features and UX patterns.

## Disclaimer

This software is provided **"as is"**, without warranty of any kind, express or implied. Use it at your own risk.

EyeOnChess is an independent open source project. It is **not affiliated with, endorsed by, or associated with** Lichess, Chess.com, Stockfish, or any other chess platform or organization. All trademarks and product names are the property of their respective owners.

## License

[MIT](LICENSE)
