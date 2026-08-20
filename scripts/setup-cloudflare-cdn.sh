#!/usr/bin/env bash
# Подключение Cloudflare CDN (proxy) для motrip.ru.
# Требует GitHub secret CF_API_TOKEN с правами Zone:Edit, DNS:Edit.
# После включения proxy в Cloudflare DNS трафик пойдёт через edge IP, не 72.56.32.183.
set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN (Cloudflare API token)}"
: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"

API="https://api.cloudflare.com/client/v4"
auth=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

zone_id() {
  curl -sf "${auth[@]}" "$API/zones?name=motrip.ru" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d['result'] else '')"
}

upsert_a() {
  local name=$1
  local ip=72.56.32.183
  local zid
  zid=$(zone_id)
  [ -n "$zid" ] || { echo "Zone motrip.ru not found in Cloudflare. Add domain first."; exit 1; }
  echo "Zone ID: $zid"

  existing=$(curl -sf "${auth[@]}" "$API/zones/$zid/dns_records?type=A&name=$name")
  rec_id=$(echo "$existing" | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')")

  body=$(python3 -c "import json; print(json.dumps({'type':'A','name':'$name','content':'$ip','proxied':True,'ttl':1}))")
  if [ -n "$rec_id" ]; then
    curl -sf -X PUT "${auth[@]}" -d "$body" "$API/zones/$zid/dns_records/$rec_id" >/dev/null
    echo "Updated A $name -> $ip (proxied)"
  else
    curl -sf -X POST "${auth[@]}" -d "$body" "$API/zones/$zid/dns_records" >/dev/null
    echo "Created A $name -> $ip (proxied)"
  fi
}

echo "=== Cloudflare CDN setup ==="
upsert_a motrip.ru
upsert_a www.motrip.ru
upsert_a staff.motrip.ru

echo ""
echo "=== SSL mode: Full (strict) recommended in Cloudflare dashboard ==="
echo "Origin already has Let's Encrypt ECDSA certs."
echo "Done. Wait 2-5 min for DNS propagation, then test without VPN."
