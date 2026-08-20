#!/usr/bin/env bash
# HTTP/2 + ECDSA certs + nginx hardening + Cloudflare-ready real IP.
# CDN DNS (Cloudflare proxy) must be enabled separately at reg.ru.
set -euo pipefail

BACKUP_DIR="/root/nginx-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -a /etc/nginx/sites-enabled/travel-app "$BACKUP_DIR/"
cp -a /etc/nginx/sites-enabled/staff-landing "$BACKUP_DIR/"

echo "=== Backup: $BACKUP_DIR ==="

# Cloudflare real client IP (safe even before CDN is enabled)
CF_CONF="/etc/nginx/conf.d/cloudflare-real-ip.conf"
if [ ! -f "$CF_CONF" ]; then
  cat > "$CF_CONF" <<'EOF'
# https://www.cloudflare.com/ips-v4 + ips-v6
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
EOF
  echo "Created $CF_CONF"
fi

echo "=== Enable HTTP/2 on vhosts ==="
for f in /etc/nginx/sites-enabled/travel-app /etc/nginx/sites-enabled/staff-landing; do
  sed -i 's/listen 443 ssl;/listen 443 ssl http2;/g' "$f"
  sed -i 's/listen 443 ssl; # managed by Certbot/listen 443 ssl http2; # managed by Certbot/g' "$f"
done

echo "=== Reissue ECDSA certificates ==="
certbot certonly --nginx --non-interactive --agree-tos --keep-until-expiring \
  --key-type ecdsa --cert-name motrip.ru -d motrip.ru -d www.motrip.ru \
  --force-renewal || certbot certonly --nginx --non-interactive --agree-tos \
  --key-type ecdsa --cert-name motrip.ru -d motrip.ru -d www.motrip.ru

certbot certonly --nginx --non-interactive --agree-tos --keep-until-expiring \
  --key-type ecdsa --cert-name staff.motrip.ru -d staff.motrip.ru \
  --force-renewal || certbot certonly --nginx --non-interactive --agree-tos \
  --key-type ecdsa --cert-name staff.motrip.ru -d staff.motrip.ru

echo "=== Test and reload nginx ==="
nginx -t
systemctl reload nginx

echo "=== Verify ==="
certbot certificates
echo "--- motrip.ru ---"
echo | openssl s_client -connect motrip.ru:443 -servername motrip.ru 2>/dev/null \
  | openssl x509 -noout -text 2>/dev/null | grep -E 'Public Key Algorithm|Signature Algorithm|DNS:'
echo "--- HTTP/2 ---"
curl -sI --http2 https://motrip.ru/ | head -5
curl -sI --http2 https://staff.motrip.ru/ | head -5

for u in https://motrip.ru/ https://staff.motrip.ru/; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u")
  echo "$u -> $code"
done

echo "=== Done. Enable Cloudflare proxy at reg.ru when ready (see docs/infrastructure.md). ==="
