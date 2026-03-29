# Cloudflare Setup

Optional guide for putting EyeOnChess behind Cloudflare for DDoS protection, CDN caching, and free SSL.

## Two Approaches

| Approach                            | SSL on Origin          | Complexity | Best For                                     |
| ----------------------------------- | ---------------------- | ---------- | -------------------------------------------- |
| **Cloudflare + Let's Encrypt**      | Certbot on your server | Medium     | Full end-to-end encryption, standard setup   |
| **Cloudflare + Origin Certificate** | Cloudflare-issued cert | Simple     | Easiest setup, Cloudflare handles everything |

Both approaches give your users HTTPS. The difference is how the connection between Cloudflare and your server is encrypted.

---

## Option A: Cloudflare + Let's Encrypt (Recommended)

Your server runs Certbot and has a real Let's Encrypt certificate. Cloudflare proxies traffic and validates your cert.

### Step 1: Add Your Domain to Cloudflare

1. Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. Click **Add a site** and enter your domain
3. Select the **Free** plan
4. Cloudflare scans your DNS records — review and confirm
5. Update your domain's nameservers at your registrar to the ones Cloudflare provides

### Step 2: Configure DNS Records

In **DNS** → **Records**, add:

| Type | Name       | Content     | Proxy status              | TTL  |
| ---- | ---------- | ----------- | ------------------------- | ---- |
| A    | `@` (root) | Your VPS IP | **DNS only** (grey cloud) | Auto |
| A    | `admin`    | Your VPS IP | **DNS only** (grey cloud) | Auto |
| A    | `grafana`  | Your VPS IP | **DNS only** (grey cloud) | Auto |

Start with **DNS only** (grey cloud) — this lets Certbot validate your domain directly. You'll enable proxying after getting the certificate.

### Step 3: Get SSL Certificate

On your server, set these in `.env`:

```bash
SITE_DOMAIN=yourdomain.com
CERTBOT_EMAIL=you@example.com
CERTBOT_DOMAINS=yourdomain.com admin.yourdomain.com grafana.yourdomain.com
SITE_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com
NODE_ENV=production
```

Start services. Certbot will obtain the certificate via HTTP-01 challenge:

```bash
docker compose --env-file .env -f deployment/docker-compose.yml up -d
# Wait for Certbot, then restart Nginx for SSL
docker compose --env-file .env -f deployment/docker-compose.yml restart nginx
```

Verify HTTPS works: `curl -I https://yourdomain.com`

### Step 4: Enable Cloudflare Proxy

Now that your server has a valid certificate, go back to Cloudflare DNS and change both records from **DNS only** to **Proxied** (orange cloud).

### Step 5: Set SSL Mode

**SSL/TLS** → **Overview** → set encryption mode to **Full (strict)**

This tells Cloudflare to always use HTTPS to your origin AND validate the certificate. Never use "Flexible" — it creates a false sense of security (HTTPS to Cloudflare, plain HTTP to your server).

### Step 6: Certificate Renewal

Certbot renews every 12 hours automatically. When proxied through Cloudflare, HTTP-01 validation still works because Cloudflare forwards the `.well-known/acme-challenge/` requests to your origin.

If renewal fails, temporarily switch DNS back to **DNS only**, renew, then re-enable proxy.

---

## Option B: Cloudflare Origin Certificate (Simpler)

Cloudflare issues a certificate that only works between Cloudflare and your server. No Certbot needed.

### Step 1: Generate Origin Certificate

1. In Cloudflare dashboard: **SSL/TLS** → **Origin Server** → **Create Certificate**
2. Keep the default settings (RSA 2048, 15 years validity)
3. Add your hostnames: `yourdomain.com` and `*.yourdomain.com`
4. Click **Create**
5. Copy the **Origin Certificate** (PEM) and **Private Key**

### Step 2: Install on Server

On your VPS, create the cert files:

```bash
mkdir -p /opt/eyeonchess/deployment/ssl
# Paste the origin certificate
nano /opt/eyeonchess/deployment/ssl/origin.pem
# Paste the private key
nano /opt/eyeonchess/deployment/ssl/origin-key.pem
chmod 600 /opt/eyeonchess/deployment/ssl/origin-key.pem
```

### Step 3: Configure Nginx

You'll need to modify `nginx.ssl.conf.template` to point to the origin cert instead of Let's Encrypt:

```nginx
ssl_certificate /etc/nginx/ssl/origin.pem;
ssl_certificate_key /etc/nginx/ssl/origin-key.pem;
```

And mount the certs in `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - ./ssl/origin.pem:/etc/nginx/ssl/origin.pem:ro
    - ./ssl/origin-key.pem:/etc/nginx/ssl/origin-key.pem:ro
```

### Step 4: Set SSL Mode

**SSL/TLS** → **Overview** → **Full (strict)**

### Step 5: Enable Proxy

Set DNS records to **Proxied** (orange cloud).

With this approach, you don't need the Certbot container at all. Leave `SITE_DOMAIN` empty in `.env`.

---

## Cloudflare Security Settings

After DNS is set up, configure these security features:

### SSL/TLS

| Setting                  | Value                                        | Location                    |
| ------------------------ | -------------------------------------------- | --------------------------- |
| Encryption mode          | **Full (strict)**                            | SSL/TLS → Overview          |
| Always Use HTTPS         | **On**                                       | SSL/TLS → Edge Certificates |
| Minimum TLS Version      | **TLS 1.2**                                  | SSL/TLS → Edge Certificates |
| TLS 1.3                  | **On**                                       | SSL/TLS → Edge Certificates |
| Automatic HTTPS Rewrites | **On**                                       | SSL/TLS → Edge Certificates |
| HSTS                     | **On** (max-age 6 months, includeSubDomains) | SSL/TLS → Edge Certificates |

### Security

| Setting                 | Value          | Location            |
| ----------------------- | -------------- | ------------------- |
| Security Level          | **Medium**     | Security → Settings |
| Bot Fight Mode          | **On**         | Security → Bots     |
| Browser Integrity Check | **On**         | Security → Settings |
| Challenge Passage       | **30 minutes** | Security → Settings |

### Speed

| Setting       | Value                  | Location                                    |
| ------------- | ---------------------- | ------------------------------------------- |
| Auto Minify   | **On** (JS, CSS, HTML) | Speed → Optimization → Content Optimization |
| Brotli        | **On**                 | Speed → Optimization → Content Optimization |
| Early Hints   | **On**                 | Speed → Optimization → Content Optimization |
| Rocket Loader | **Off**                | Speed → Optimization → Content Optimization |

Rocket Loader should be **off** — it rewrites JavaScript loading which can break Next.js hydration and Socket.IO.

### Caching

| Setting           | Value                        | Location                |
| ----------------- | ---------------------------- | ----------------------- |
| Caching Level     | **Standard**                 | Caching → Configuration |
| Browser Cache TTL | **Respect Existing Headers** | Caching → Configuration |

Nginx already sets proper cache headers (`immutable` for hashed assets, `no-store` for API). Let Cloudflare respect those.

### Network

| Setting       | Value  | Location |
| ------------- | ------ | -------- |
| WebSockets    | **On** | Network  |
| HTTP/2        | **On** | Network  |
| HTTP/3 (QUIC) | **On** | Network  |

WebSockets **must be on** — Socket.IO requires it for real-time game play.

---

## WebSocket Considerations

Socket.IO connections go through Cloudflare when proxied. Important notes:

- Cloudflare supports WebSocket connections on all plans
- WebSocket connections have a **100-second idle timeout** on the free plan. Socket.IO's heartbeat (every 20 seconds) keeps the connection alive, so this is fine
- If you see WebSocket disconnections, verify **Network → WebSockets** is enabled
- The `wss://` protocol is used automatically when Cloudflare proxies HTTPS traffic

---

## Firewall Rules (Optional)

To further protect your origin:

### Block Direct IP Access

After enabling Cloudflare proxy, block direct access to your server IP so all traffic must go through Cloudflare:

On your VPS (using `ufw`):

```bash
# Allow SSH
ufw allow 22/tcp

# Allow Cloudflare IPs only on port 80 and 443
# Cloudflare IPv4 ranges: https://www.cloudflare.com/ips-v4/
for ip in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
  ufw allow from $ip to any port 80,443 proto tcp
done

# Block everything else on 80/443
ufw deny 80/tcp
ufw deny 443/tcp

ufw enable
```

This ensures nobody can bypass Cloudflare by hitting your IP directly.

### Rate Limiting via Cloudflare

Cloudflare's rate limiting can complement your app-level rate limits:

1. **Security** → **WAF** → **Rate limiting rules** → **Create rule**
2. Target: `URI Path contains /api/v1/auth/login`
3. Rate: 10 requests per minute per IP
4. Action: Block for 10 minutes

This provides a second layer of brute-force protection before requests even reach your server.

---

## Troubleshooting

### "Too many redirects" after enabling proxy

Your Cloudflare SSL mode is set to **Flexible** but your server is redirecting HTTP → HTTPS. Fix: set SSL mode to **Full (strict)**.

### WebSocket connections failing

Check **Network → WebSockets** is enabled. Also verify your Nginx config has the WebSocket upgrade headers (it does by default in EyeOnChess).

### Certbot renewal fails after enabling proxy

Cloudflare's proxy can interfere with HTTP-01 validation. Options:

1. Temporarily switch DNS to **DNS only**, renew, switch back
2. Use Cloudflare DNS plugin for certbot (DNS-01 challenge) — doesn't require HTTP access

### CSS/JS not loading or broken layout

**Rocket Loader** is likely on. Turn it off: **Speed → Optimization → Content Optimization → Rocket Loader → Off**.

### API calls failing with CORS errors

Make sure `SITE_URL` in your `.env` matches your Cloudflare-proxied domain exactly (including `https://`). CORS checks the `Origin` header against `SITE_URL`.
