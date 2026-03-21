# Quick Start

Get EyeOnChess running in under 5 minutes.

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose)

## Setup

```bash
git clone https://github.com/amiwrpremium/eye-on-chess.git
cd eye-on-chess
cp .env.example .env
```

Edit `.env` and change at minimum:

- `JWT_SECRET` — Generate with `openssl rand -hex 32`
- `SEED_USER_PASSWORD` — Your admin password

## Start

### Production (Nginx on port 80)

```bash
docker compose -f deployment/docker-compose.yml up -d
```

Open **http://localhost** and log in with the admin credentials from your `.env`.

### Development (Hot reload)

```bash
docker compose -f deployment/docker-compose.dev.yml up --build
```

| Service  | URL                   |
| -------- | --------------------- |
| Web      | http://localhost:3000 |
| API      | http://localhost:3001 |
| Postgres | localhost:5432        |
| Redis    | localhost:6379        |

### Using Make

```bash
make up          # Production
make dev         # Development (foreground)
make dev-up      # Development (background)
make help        # Show all commands
```

## First Login

1. Open the site in your browser
2. Log in with the seed admin credentials:
   - Email: value of `SEED_USER_EMAIL` (default: `admin@eyeonchess.local`)
   - Password: value of `SEED_USER_PASSWORD` (default: `changeme123`)
3. Access the admin panel from the Play page (purple "Admin Panel" button)

## Stopping

```bash
make down        # Stop production
make dev-down    # Stop development
make clean       # Stop all
```
