# Nginx Configuration

Nginx serves as the reverse proxy, providing a single entry point on ports 80 (HTTP) and 443 (HTTPS).

## Configuration Files

| File                                 | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `deployment/nginx.http.conf`         | HTTP-only config (used when no SSL certs exist)      |
| `deployment/nginx.ssl.conf.template` | HTTPS config template with `${SITE_DOMAIN}` variable |
| `deployment/nginx-entrypoint.sh`     | Entrypoint script that picks HTTP or SSL config      |
| `deployment/nginx.dev.conf`          | Development config (HTTP only, HMR support)          |

## How the Entrypoint Works

On startup, `nginx-entrypoint.sh` checks:

1. Is `SITE_DOMAIN` set?
2. Do SSL certs exist at `/etc/letsencrypt/live/$SITE_DOMAIN/fullchain.pem`?

- **Both true** → uses `nginx.ssl.conf.template` (envsubst replaces `${SITE_DOMAIN}`) → HTTPS mode
- **Otherwise** → copies `nginx.http.conf` as-is → HTTP-only mode

This means:

- First boot with `SITE_DOMAIN` set: starts HTTP (certs don't exist yet), Certbot gets cert, then restart Nginx to switch to HTTPS
- Subsequent boots: auto-detects certs and uses HTTPS
- No `SITE_DOMAIN`: always HTTP (development/localhost)

## Routing Rules

| Path                            | Upstream          | Notes                                  |
| ------------------------------- | ----------------- | -------------------------------------- |
| `/api/v1/*`                     | `api:3001`        | REST API routes                        |
| `/api/*`                        | 301 → `/api/v1/*` | Backward compatibility redirect        |
| `/api/v1/bots`                  | `api:3001`        | Cached: `max-age=3600` (1 hour)        |
| `/health`                       | `api:3001`        | Health check endpoint                  |
| `/metrics`                      | `api:3001`        | Prometheus metrics (internal IPs only) |
| `/socket.io/*`                  | `api:3001`        | WebSocket with upgrade headers         |
| `/_next/static/*`               | `web:3000`        | Immutable cache (365 days)             |
| `*.png,jpg,wasm,...`            | `web:3000`        | Static files cached 30 days            |
| `/.well-known/acme-challenge/*` | Certbot webroot   | SSL only — Let's Encrypt validation    |
| `/*` (everything else)          | `web:3000`        | Next.js frontend                       |

### Admin Subdomain

Requests to `admin.{SITE_DOMAIN}` are routed to `admin:3002`:

| Path | Upstream     | Notes          |
| ---- | ------------ | -------------- |
| `/*` | `admin:3002` | Admin panel UI |

### Grafana Subdomain

Requests to `grafana.{SITE_DOMAIN}` are routed to `grafana:3000`:

| Path          | Upstream       | Notes                    |
| ------------- | -------------- | ------------------------ |
| `/*`          | `grafana:3000` | Grafana UI               |
| `/api/live/*` | `grafana:3000` | Grafana WebSocket (live) |

## WebSocket Support

Socket.IO requires HTTP upgrade headers:

```nginx
location /socket.io/ {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

The `proxy_read_timeout 86400` (24 hours) prevents Nginx from closing idle WebSocket connections.

## Headers

All proxied requests include:

- `X-Real-IP` — client's real IP address
- `X-Forwarded-For` — full proxy chain
- `X-Forwarded-Proto` — original protocol (http/https)
- `Host` — original host header

### SSL Headers (HTTPS mode only)

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — HSTS (1 year)

## SSL Configuration (HTTPS mode)

When SSL is active, Nginx uses:

- **TLS 1.2 and 1.3** only (TLS 1.0/1.1 disabled)
- **Strong cipher suite** — ECDHE with AES-GCM
- **Session caching** — 10MB shared cache, 1 day timeout
- **No session tickets** — for forward secrecy
- **HTTP/2** enabled on port 443
- **HTTP → HTTPS redirect** — all port 80 traffic redirected to 443 (except ACME challenge)

Certificates are mounted from the `certbot-certs` Docker volume at `/etc/letsencrypt/`. The volume is writable so the nginx cert renewal watcher can delete the `.renewed` flag file.

## Compression

Gzip enabled for:

- text/plain, text/css, text/javascript
- application/javascript, application/json, application/xml
- image/svg+xml, font/woff2

Minimum size: 256 bytes. Compression level: 6.

## Proxy Buffering

- `proxy_buffering on`
- `proxy_buffer_size 16k`
- `proxy_buffers 8 16k`

## Limits

- `client_max_body_size 10M` — prevents large request body attacks

## Caching

| Resource              | Cache Duration | Header                 |
| --------------------- | -------------- | ---------------------- |
| `/_next/static/*`     | 365 days       | `public, immutable`    |
| `/favicon.ico`        | 30 days        | (nginx expires)        |
| Static files (images) | 30 days        | `public`               |
| `/api/v1/bots`        | 1 hour         | `public, max-age=3600` |
| API routes            | No cache       | `no-store`             |
