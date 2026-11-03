#!/usr/bin/env bash
# ============================================================================
# Deploy / update FnB Digital di VPS.
#
# Pakai:
#   sudo mkdir -p /var/www && sudo chown -R "$USER":"$USER" /var/www
#   git clone https://github.com/frmnardd/fnb-digital.git /var/www/fnb
#   cd /var/www/fnb && cp .env.example .env && nano .env   # isi kredensial
#   bash scripts/deploy.sh
#
# Update berikutnya cukup: bash scripts/deploy.sh
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fnb}"
PORT="${PORT:-3000}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> 1/6 Menarik kode terbaru (branch $BRANCH)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> 2/6 Memasang dependensi (npm ci)"
npm ci --no-audit --no-fund

echo "==> 3/6 Prisma generate + migrate deploy"
npx prisma generate
npx prisma migrate deploy

echo "==> 4/6 Build produksi"
npm run build

echo "==> 5/6 Menjalankan / memuat ulang PM2"
mkdir -p logs
if pm2 describe fnb-digital >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> 6/6 Health check"
sleep 3
curl -fsS "http://127.0.0.1:${PORT}/" -o /dev/null
curl -fsS "http://127.0.0.1:${PORT}/api/menu" -o /dev/null
echo "Deploy selesai. Aplikasi sehat di http://127.0.0.1:${PORT}"
