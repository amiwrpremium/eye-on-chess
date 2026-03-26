#!/bin/sh
# ──────────────────────────────────────────────────────────
# Nginx entrypoint — picks HTTP or SSL config based on
# whether SITE_DOMAIN is set and certs exist.
# ──────────────────────────────────────────────────────────
set -e

if [ -n "$SITE_DOMAIN" ] && [ -f "/etc/letsencrypt/live/$SITE_DOMAIN/fullchain.pem" ]; then
  echo "SSL certs found for $SITE_DOMAIN — enabling HTTPS"
  envsubst '${SITE_DOMAIN}' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
  if [ -n "$SITE_DOMAIN" ]; then
    echo "SSL certs not found for $SITE_DOMAIN — starting HTTP-only (run certbot first)"
  fi
  cp /etc/nginx/http.conf /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
