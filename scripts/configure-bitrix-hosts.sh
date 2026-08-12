#!/usr/bin/env bash
# Настройка доступа к Bitrix24 на выделенном IP (crm.mosgortur.ru → 81.23.1.216).
# Запускается при деплое на VPS. При успешном прямом REST убирает прокси b24catch.
set -euo pipefail

BITRIX_HOST="${BITRIX_HOST:-crm.mosgortur.ru}"
BITRIX_IP="${BITRIX_IP:-81.23.1.216}"
ENV_FILE="${ENV_FILE:-/home/travel-app/.env.local}"
HOSTS_FILE=/etc/hosts
HOSTS_MARKER="# motrip-bitrix-dedicated-ip"

WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-}"
if [ -z "$WEBHOOK_TOKEN" ] && [ -f "$ENV_FILE" ]; then
  WEBHOOK_TOKEN="$(grep '^WEBHOOK_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
fi
WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-1981/0ly7df3o8j23eq30}"

set_env_var() {
  local key="$1"
  local val="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

remove_env_var() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  sed -i.bak "/^${key}=/d" "$ENV_FILE"
}

echo "=== Bitrix hosts: ${BITRIX_HOST} → ${BITRIX_IP} ==="

# Удаляем старые записи motrip для этого хоста (в т.ч. прежний .210)
sed -i.bak "/${HOSTS_MARKER}/d" "$HOSTS_FILE" 2>/dev/null || true
sed -i.bak "/[[:space:]]${BITRIX_HOST//./\\.}[[:space:]]*$/d" "$HOSTS_FILE" 2>/dev/null || true
printf '%s %s %s\n' "$BITRIX_IP" "$BITRIX_HOST" "$HOSTS_MARKER" >> "$HOSTS_FILE"

echo "=== /etc/hosts entry ==="
grep "$BITRIX_HOST" "$HOSTS_FILE" || true

echo "=== ping ${BITRIX_IP} (2 packets) ==="
ping -c 2 -W 3 "$BITRIX_IP" || true

echo "=== TCP/443 ${BITRIX_IP} ==="
timeout 8 bash -c "cat < /dev/null > /dev/tcp/${BITRIX_IP}/443" && echo "TCP/443 OPEN" || echo "TCP/443 BLOCKED"

echo "=== HTTPS ${BITRIX_HOST} (via hosts → ${BITRIX_IP}) ==="
curl -m 10 -s -o /dev/null -w "portal HTTP:%{http_code} TIME:%{time_total}s\n" "https://${BITRIX_HOST}/" || echo "portal: failed"

echo "=== REST probe (direct, no b24catch) ==="
REST_HTTP="$(curl -m 15 -s -o /tmp/bitrix-rest-probe.json -w '%{http_code}' \
  -X POST "https://${BITRIX_HOST}/rest/${WEBHOOK_TOKEN}/crm.contact.list.json" \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"PHONE":"+79991234567"},"select":["ID"]}' || echo "000")"
echo "REST HTTP:${REST_HTTP}"
head -c 200 /tmp/bitrix-rest-probe.json 2>/dev/null || true
echo ""

PROXY_URL="https://it.mosgortur.ru/b24catch"
if [ "$REST_HTTP" = "200" ] && grep -q '"result"' /tmp/bitrix-rest-probe.json 2>/dev/null; then
  echo "=== Direct Bitrix REST OK — switching off b24catch proxy ==="
  remove_env_var BITRIX_REST_BASE_URL
  remove_env_var REBOOKING_BITRIX_REST_BASE_URL
else
  echo "=== Direct REST not ready (HTTP:${REST_HTTP}) — keeping b24catch proxy ==="
  set_env_var BITRIX_REST_BASE_URL "$PROXY_URL"
  PROXY_HTTP="$(curl -m 15 -s -o /tmp/bitrix-proxy-probe.json -w '%{http_code}' \
    -X POST "${PROXY_URL}/${WEBHOOK_TOKEN}/crm.contact.list.json" \
    -H 'Content-Type: application/json' \
    -d '{"filter":{"PHONE":"+79991234567"},"select":["ID"]}' || echo "000")"
  echo "Proxy REST HTTP:${PROXY_HTTP}"
  head -c 200 /tmp/bitrix-proxy-probe.json 2>/dev/null || true
  echo ""
fi

echo "=== Bitrix env (BITRIX_REST_BASE_URL) ==="
grep -E '^BITRIX_REST_BASE_URL=' "$ENV_FILE" 2>/dev/null || echo "BITRIX_REST_BASE_URL not set (direct mode)"
