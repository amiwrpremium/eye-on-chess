# Database Migrations

EyeOnChess uses [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate) for all schema changes.

## Migration History

| Migration                           | Description                                                              |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `20260320202540_init`               | Initial schema: User, Friendship, Game, Move, GameAnalysis, MoveFeedback |
| `20260320205411_add_refresh_tokens` | RefreshToken model for JWT session management                            |
| `20260321175924_user_preferences`   | User: darkMode, boardTheme, pieceSet, verified columns                   |
| `20260321185520_add_user_active`    | User: active boolean                                                     |
| `20260321192321_admin_panel`        | UserRole enum, User.role, SiteSettings model, AuditLog model             |

## How Migrations Run

### In Docker (automatic)

The API Dockerfile CMD runs migrations before starting the server:

```
prisma migrate deploy → prisma db seed → tsx watch src/server.ts
```

This means:

- Migrations are applied automatically on every container start
- The seed script runs on every start (uses `upsert`, so it's idempotent)
- No manual intervention needed

### Locally (manual)

```bash
cd apps/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eyeonchess \
  npx prisma migrate dev --name your-migration-name
```

Or from inside the container:

```bash
make shell-api
npx prisma migrate dev --name your-migration-name
```

## Creating a New Migration

1. Edit `apps/api/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive-name`
3. Prisma generates a SQL migration in `prisma/migrations/`
4. Commit both the schema change and the migration file

## Rules

- **Never** edit existing migration files
- **Never** use raw SQL for schema changes
- **Always** use `prisma migrate dev` to create migrations
- **Always** commit migration files with the schema change
- Use `prisma migrate deploy` in production (not `dev`)

## Resetting the Database

```bash
make db-reset    # Stops containers, removes volumes, rebuilds
```

This destroys all data and re-runs migrations from scratch.

## Prisma Studio

Visual database browser:

```bash
make db-studio   # Opens at http://localhost:5555
```

Requires the dev compose to be running (for Postgres access on localhost:5432).
