#!/usr/bin/env bash
# ============================================================================
# Backup database Supabase (pg_dump) ke folder lokal + rotasi 7 hari.
#
# Pakai (cron harian 02:00 WIB):
#   0 2 * * * /var/www/fnb/scripts/backup-db.sh >> /var/log/fnb-backup.log 2>&1
#
# Butuh: `postgresql-client` (pg_dump) dan `.env` berisi DIRECT_URL.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fnb}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: .env tidak ditemukan di $APP_DIR" >&2
  exit 1
fi

DB_URL="$(grep -E '^DIRECT_URL=' .env | head -n1 | cut -d= -f2- | tr -d '"')"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DIRECT_URL tidak ada di .env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/fnb-$STAMP.sql.gz"

echo "==> Backup ke $OUT"
pg_dump --no-owner --no-privileges --dbname="$DB_URL" | gzip > "$OUT"

echo "==> Rotasi backup lebih dari $RETENTION_DAYS hari"
find "$BACKUP_DIR" -name 'fnb-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Selesai. Ukuran: $(du -h "$OUT" | cut -f1)"
