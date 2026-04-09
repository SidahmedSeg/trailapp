#!/bin/bash
# PostgreSQL restore script
# Usage: ./restore.sh /path/to/backup.sql.gz

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Available backups:"
  ls -lh /var/backups/trail-mouflons/trail_mouflons_*.sql.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: File not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "WARNING: This will REPLACE the current database!"
echo "Restoring from: ${BACKUP_FILE}"
read -p "Type 'yes' to continue: " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Drop and recreate database
PGPASSWORD=postgres psql -h localhost -p 8833 -U postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'trail_mouflons' AND pid <> pg_backend_pid();
"
PGPASSWORD=postgres dropdb -h localhost -p 8833 -U postgres trail_mouflons --if-exists
PGPASSWORD=postgres createdb -h localhost -p 8833 -U postgres trail_mouflons

# Restore
gunzip -c "${BACKUP_FILE}" | PGPASSWORD=postgres psql -h localhost -p 8833 -U postgres trail_mouflons

echo "Restore completed successfully"
echo "Remember to also restore Redis bib:next if needed"
