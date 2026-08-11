#!/usr/bin/env bash
set -euo pipefail

SRC=/home/travel-app/apps/staff-landing
DST=/var/www/staff-landing

if [ ! -d "$SRC" ]; then
  echo "Missing $SRC — pull travel-app main first"
  exit 1
fi

mkdir -p "$DST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .env.local \
  --exclude data \
  "$SRC/" "$DST/"

mkdir -p "$DST/data"
cd "$DST"
touch .env.local
if ! grep -q '^STAFF_SESSION_SECRET=.' .env.local; then
  echo "STAFF_SESSION_SECRET=$(openssl rand -base64 32)" >> .env.local
  echo "Created STAFF_SESSION_SECRET in $DST/.env.local"
fi
if ! grep -q '^COOKIE_SECURE=' .env.local; then
  echo 'COOKIE_SECURE=true' >> .env.local
fi
if ! grep -q '^STAFF_ADMIN_PASSWORD=.' .env.local; then
  echo "WARNING: set STAFF_ADMIN_PASSWORD in $DST/.env.local for /admin access"
fi

npm install
npm run build
pm2 restart staff-landing
pm2 status staff-landing
