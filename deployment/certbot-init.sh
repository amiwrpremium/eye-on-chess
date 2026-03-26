#!/bin/sh
# ──────────────────────────────────────────────────────────
# Certbot init — gets initial cert then renews every 12h.
# Skips entirely if SITE_DOMAIN is not set.
# ──────────────────────────────────────────────────────────
set -e

if [ -z "$SITE_DOMAIN" ]; then
  echo "SITE_DOMAIN not set — skipping certbot (HTTP-only mode)"
  exit 0
fi

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "ERROR: CERTBOT_EMAIL is required when SITE_DOMAIN is set"
  exit 1
fi

# Wait for Nginx to be ready (serves ACME challenge on port 80)
echo "Waiting for Nginx..."
sleep 10

# Get initial cert if it doesn't exist
if [ ! -f "/etc/letsencrypt/live/$SITE_DOMAIN/fullchain.pem" ]; then
  echo "Requesting initial certificate for $SITE_DOMAIN..."
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$SITE_DOMAIN" \
    -d "grafana.$SITE_DOMAIN" \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --non-interactive \
    --no-eff-email

  echo ""
  echo "============================================"
  echo "Certificate obtained! Restart Nginx to enable HTTPS:"
  echo "  docker compose restart nginx"
  echo "============================================"
  echo ""
else
  echo "Certificate already exists for $SITE_DOMAIN"
fi

# Renewal loop — check every 12 hours
echo "Starting renewal loop..."
while true; do
  sleep 12h
  echo "Checking for certificate renewal..."
  certbot renew --quiet
done
