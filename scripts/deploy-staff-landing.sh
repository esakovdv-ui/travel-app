#!/usr/bin/env bash
set -euo pipefail

SRC=/home/travel-app/apps/staff-landing
DST=/var/www/staff-landing

# Подтянуть актуальный monorepo (включая docs/) перед копированием
if [ -d /home/travel-app/.git ]; then
  cd /home/travel-app
  ok=0
  for attempt in 1 2 3 4 5 6; do
    if git fetch origin && git checkout -f main && git reset --hard origin/main; then
      ok=1
      break
    fi
    echo "git sync retry $attempt (travel-app deploy may hold refs)"
    sleep 20
  done
  if [ "$ok" != 1 ]; then
    echo "WARN: could not refresh /home/travel-app; using current tree"
  fi
fi

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
set_env_var() {
  key="$1"
  val="$2"
  if grep -q "^${key}=" .env.local; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" .env.local
  else
    printf '%s=%s\n' "$key" "$val" >> .env.local
  fi
}
set_env_var STAFF_ADMIN_PASSWORD 'staff_mgt_2026'

# Документация для людей/ИИ на сервере staff
mkdir -p "$DST/docs"
cp -f /home/travel-app/AGENTS.md /home/travel-app/PROJECT.md /home/travel-app/README.md "$DST/docs/" 2>/dev/null || true
cp -f /home/travel-app/docs/*.md "$DST/docs/" 2>/dev/null || true
if [ -f "$SRC/README.md" ]; then
  cp -f "$SRC/README.md" "$DST/docs/staff-landing.md"
fi
echo "=== docs on staff-landing ==="
ls -la "$DST/docs" || true

rm -rf .next
npm install
npm run build
pm2 restart staff-landing
pm2 status staff-landing
echo "=== docs on travel-app ==="
ls -la /home/travel-app/docs /home/travel-app/PROJECT.md /home/travel-app/AGENTS.md 2>/dev/null || true
