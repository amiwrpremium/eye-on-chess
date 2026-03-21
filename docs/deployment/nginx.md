# Nginx Configuration

Nginx serves as the reverse proxy in production, providing a single entry point on port 80.

## Routing Rules

| Path                   | Upstream   | Notes                          |
| ---------------------- | ---------- | ------------------------------ |
| `/api/*`               | `api:3001` | REST API routes                |
| `/health`              | `api:3001` | Health check endpoint          |
| `/socket.io/*`         | `api:3001` | WebSocket with upgrade headers |
| `/*` (everything else) | `web:3000` | Next.js frontend               |

## WebSocket Support

Socket.io requires HTTP upgrade headers. The Nginx config includes:

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

- `X-Real-IP` — client's real IP
- `X-Forwarded-For` — proxy chain
- `X-Forwarded-Proto` — original protocol (http/https)
- `Host` — original host header

## Limits

- `client_max_body_size 10M` — prevents large request body attacks

## Configuration File

Located at `deployment/nginx.conf`, mounted read-only into the Nginx container at `/etc/nginx/conf.d/default.conf`.

## HTTPS (Optional)

To add HTTPS, you can:

1. **Use a reverse proxy in front** (Cloudflare, Traefik, Caddy)
2. **Add SSL to Nginx** by modifying the config to listen on 443 with your cert/key and adding a 80→443 redirect

When using HTTPS, ensure:

- `NODE_ENV=production` is set (enables secure cookies)
- `SITE_URL` uses `https://`
- `NEXT_PUBLIC_API_URL` uses `https://`
