#!/bin/bash
# Backup EyeOnChess PostgreSQL database
# Usage: ./scripts/backup.sh
#
# Optional encryption: set BACKUP_ENCRYPTION_KEY to a passphrase.
# Encrypted backups use AES-256-CBC via openssl.
# To restore: openssl enc -aes-256-cbc -d -pbkdf2 -in backup.sql.gz.enc | gunzip | psql ...

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  FILENAME="eyeonchess_${TIMESTAMP}.sql.gz.enc"
  echo "Backing up database (encrypted) to ${BACKUP_DIR}/${FILENAME}..."
  docker compose --env-file .env -f deployment/docker-compose.cd.yml exec -T postgres pg_dump -U postgres eyeonchess \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
    > "${BACKUP_DIR}/${FILENAME}"
  PATTERN="eyeonchess_*.sql.gz.enc"
else
  FILENAME="eyeonchess_${TIMESTAMP}.sql.gz"
  echo "Backing up database to ${BACKUP_DIR}/${FILENAME}..."
  echo "  (Set BACKUP_ENCRYPTION_KEY to enable encryption)"
  docker compose --env-file .env -f deployment/docker-compose.cd.yml exec -T postgres pg_dump -U postgres eyeonchess \
    | gzip \
    > "${BACKUP_DIR}/${FILENAME}"
  PATTERN="eyeonchess_*.sql.gz"
fi

# Verify backup is non-empty
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
  echo "ERROR: Backup file is empty, removing"
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

echo "Backup complete: ${BACKUP_DIR}/${FILENAME}"
echo "Size: $(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"

# Keep only last 7 backups
ls -tp "${BACKUP_DIR}"/${PATTERN} 2>/dev/null | tail -n +8 | xargs -r rm --
echo "Old backups cleaned (keeping last 7)"
