#!/bin/bash
# PostgreSQL backup script
# Run via cron: 0 3 * * * /path/to/backup.sh

set -euo pipefail

BACKUP_DIR="/var/backups/trail-mouflons"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/trail_mouflons_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Dump database (compressed) — runs pg_dump inside the container
# so we don't need postgresql-client installed on the host.
docker exec -e PGPASSWORD=postgres trail-postgres pg_dump \
  -U postgres trail_mouflons \
  | gzip > "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Remove old backups
find "${BACKUP_DIR}" -name "trail_mouflons_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Cleaned backups older than ${RETENTION_DAYS} days"

# Verify backup is not empty
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file is empty!" >&2
  exit 1
fi

echo "Backup completed successfully"
