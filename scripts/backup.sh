#!/bin/bash
# Backup EyeOnChess PostgreSQL database
# Usage: ./scripts/backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="eyeonchess_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database to ${BACKUP_DIR}/${FILENAME}..."

docker compose -f deployment/docker-compose.yml exec -T postgres pg_dump -U postgres eyeonchess | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup complete: ${BACKUP_DIR}/${FILENAME}"
echo "Size: $(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"

# Keep only last 7 backups
ls -tp "${BACKUP_DIR}"/eyeonchess_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm --
echo "Old backups cleaned (keeping last 7)"
