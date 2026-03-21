# EyeOnChess Documentation

Welcome to the EyeOnChess documentation. EyeOnChess is a fully self-hostable, open source chess platform.

## Table of Contents

### Getting Started

- [Quick Start](getting-started/quick-start.md) — Get running in 5 minutes
- [Configuration](getting-started/configuration.md) — Environment variables reference
- [Development Setup](getting-started/development.md) — Setting up for local development

### Architecture

- [Overview](architecture/overview.md) — System architecture and tech stack
- [Project Structure](architecture/project-structure.md) — Directory layout and conventions

### Deployment

- [Docker Compose](deployment/docker-compose.md) — Production and development Docker setup
- [Dockerfiles](deployment/dockerfiles.md) — Container build details
- [Nginx](deployment/nginx.md) — Reverse proxy configuration
- [Backup & Restore](deployment/backup.md) — Database backup and recovery

### Backend API

- [Authentication](api/authentication.md) — JWT auth, login, register, refresh
- [Users & Friends](api/users-friends.md) — User profiles, friend system, search
- [Games](api/games.md) — Game creation, real-time play, clocks
- [Analysis](api/analysis.md) — Stockfish post-game analysis pipeline
- [Admin](api/admin.md) — Admin panel API, CSRF, audit logging
- [WebSocket Events](api/websocket.md) — Socket.io events reference

### Frontend

- [Pages](frontend/pages.md) — All routes and their purpose
- [Components](frontend/components.md) — Reusable UI components
- [State Management](frontend/state.md) — Zustand stores
- [Theming](frontend/theming.md) — Dark/light mode, board themes, piece sets

### Admin Panel

- [Overview](admin/overview.md) — Admin panel features and access
- [Security](admin/security.md) — CSRF, rate limiting, audit logging
- [User Management](admin/users.md) — Managing users
- [Site Settings](admin/settings.md) — Configuring the platform

### Database

- [Schema](database/schema.md) — Prisma models and relationships
- [Migrations](database/migrations.md) — Managing database changes
