# Backup & Restore

## Backup

Run the backup script from the project root:

```bash
./scripts/backup.sh
# or: make backup
```

This will:

1. Run `pg_dump` against the Postgres container
2. Compress the output with gzip
3. Save to `./backups/eyeonchess_YYYYMMDD_HHMMSS.sql.gz`
4. Auto-delete backups older than the 7 most recent

### Custom Backup Directory

```bash
BACKUP_DIR=/path/to/backups ./scripts/backup.sh
```

## Restore

```bash
gunzip -c backups/eyeonchess_20260321_120000.sql.gz | \
  docker compose -f deployment/docker-compose.yml exec -T postgres psql -U postgres eyeonchess
# or: make restore FILE=backups/eyeonchess_20260321_120000.sql.gz
```

> **Warning:** This overwrites all existing data in the database.

## What's Backed Up

The backup includes all PostgreSQL data:

- Users (credentials, ratings, preferences)
- Games (moves, PGN, FEN history)
- Analysis (evaluations, move classifications)
- Friendships
- Refresh tokens
- Site settings
- Audit logs

## What's NOT Backed Up

- Redis data (online presence, game clocks, analysis queue) — persisted via AOF (`--appendonly yes`) in the `redis_data` Docker volume, but not included in the pg_dump backup. Redis data survives container restarts but is not backed up offsite.
- Docker volumes are not included — back up `eyeonchess-pgdata` and `eyeonchess-redis-data` volumes separately if needed

## Automated Backups

Add a cron job for automated backups:

```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/eye-on-chess && ./scripts/backup.sh >> /var/log/eyeonchess-backup.log 2>&1
```
