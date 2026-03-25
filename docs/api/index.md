# Backend API

- [Authentication](authentication.md) — JWT auth flow, token rotation, auto-refresh
- [Users & Friends](users-friends.md) — User profiles, search, friend system
- [Games](games.md) — Game creation, challenges, time controls, Elo rating
- [Analysis](analysis.md) — Stockfish analysis pipeline, move classification, accuracy
- [Admin](admin.md) — Admin API endpoints, CSRF, audit logging
- [Invites](invites.md) — Invite code generation, validation, quota system
- [Collections](collections.md) — Game collections (favorites, custom lists)
- [Stats](stats.md) — Personal stats dashboard (rating, record, openings, accuracy, streaks)
- [Activity](activity.md) — Activity feed (recent games, analyses, friendships)
- [Notes](notes.md) — Personal game notes
- [WebSocket Events](websocket.md) — Socket.io real-time events reference

## API Versioning

All API endpoints are versioned under `/api/v1/`. For example:

- `POST /api/v1/auth/login`
- `GET /api/v1/games/:id`
- `GET /api/v1/bots`

Requests to the old `/api/*` paths are permanently redirected (301) to `/api/v1/*` for backward compatibility.

## Interactive API Docs

Swagger UI is available at **`/docs`** in development and production. The OpenAPI spec is auto-generated from route schemas at runtime.

- `/docs` — Interactive Swagger UI
- `/docs/json` — Raw OpenAPI 3.0 JSON spec

## Security Headers

All API responses include security headers via `@fastify/helmet`:

| Header                              | Value              | Purpose                       |
| ----------------------------------- | ------------------ | ----------------------------- |
| `X-Frame-Options`                   | `SAMEORIGIN`       | Prevents clickjacking         |
| `X-Content-Type-Options`            | `nosniff`          | Prevents MIME type sniffing   |
| `X-DNS-Prefetch-Control`            | `off`              | Prevents DNS prefetch leaks   |
| `X-Download-Options`                | `noopen`           | Prevents IE file execution    |
| `X-Permitted-Cross-Domain-Policies` | `none`             | Blocks Flash/PDF cross-domain |
| `Strict-Transport-Security`         | `max-age=15552000` | HSTS in production            |

Content-Security-Policy is enabled with pragmatic directives:

| Directive      | Value                              | Reason                                  |
| -------------- | ---------------------------------- | --------------------------------------- |
| `default-src`  | `'self'`                           | Only same-origin by default             |
| `script-src`   | `'self' 'unsafe-inline' 'unsafe-eval'` | Next.js dev + Swagger UI YAML parser |
| `style-src`    | `'self' 'unsafe-inline'`           | Tailwind CSS + Chessground inline styles |
| `img-src`      | `'self' data: blob:`               | Data URIs for inline images             |
| `connect-src`  | `'self' ws: wss:`                  | WebSocket for Socket.IO                 |
| `worker-src`   | `'self' blob:`                     | Stockfish WASM web worker               |
| `font-src`     | `'self'`                           | Local fonts only                        |
| `media-src`    | `'self'`                           | Sound files                             |
| `object-src`   | `'none'`                           | No plugins                              |
| `frame-src`    | `'none'`                           | No iframes                              |

`unsafe-inline` and `unsafe-eval` are required for Tailwind, Chessground, Next.js development, and Swagger UI. In production, these could be tightened with nonces.

## CORS

Cross-origin requests are restricted to the configured `SITE_URL`:

- **Production** (`NODE_ENV=production`): Only the exact `SITE_URL` origin is allowed
- **Development**: `SITE_URL` plus any `http://localhost` variant
- Requests with no `Origin` header (server-to-server, curl, mobile apps) are always allowed

Set `SITE_URL` in your `.env` to match your frontend domain (e.g. `https://chess.example.com`).

## Error Codes

All error responses include a machine-readable `code` field alongside the human-readable `error` message:

```json
{
  "code": "AUTH_INVALID_CREDENTIALS",
  "error": "Invalid credentials"
}
```

Error codes follow `DOMAIN_SPECIFIC_ERROR` naming in SCREAMING*SNAKE_CASE. Domains: `AUTH*\_`, `GAME\__`, `FRIEND*\*`, `ADMIN*_`, `COLLECTION\__`, `INVITE*\*`, `ANALYSIS*_`, `NOTE\_\_`. Generic codes: `VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`, `INTERNAL_ERROR`.

All error code constants are defined in `apps/api/src/lib/errorCodes.ts`. The `apiError(reply, status, code, message)` helper standardizes error responses across all routes.

## Request Validation

All request bodies, URL parameters, and query strings are validated at runtime using [Zod](https://zod.dev/) schemas via `fastify-type-provider-zod`. Validation runs before the route handler — invalid requests get a `400` response immediately without hitting any business logic.

Schemas are defined in `apps/api/src/lib/schemas.ts` and referenced in route definitions via Fastify's `schema` option:

```typescript
app.post("/auth/login", { schema: { body: loginBodySchema } }, handler);
```

Validation errors return:

```json
{ "error": "Invalid email; Password must be at least 8 characters" }
```

## Rate Limiting

Rate limits are enforced per user for authenticated requests and per IP for anonymous requests:

- **Authenticated**: `request.user.userId` is the rate limit key — each user gets their own quota
- **Anonymous** (login, register, public endpoints): `request.ip` is the key
- Global defaults and per-route overrides are configured in `deployment/config/rate-limits.yml`
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) are included in responses

## Pagination

List endpoints support standard pagination via query parameters:

```
GET /api/v1/games/history?page=2&limit=10
```

| Parameter | Default | Range | Description    |
| --------- | ------- | ----- | -------------- |
| `page`    | 1       | 1+    | Page number    |
| `limit`   | 20      | 1-50  | Items per page |

Response includes a `pagination` object:

```json
{
  "data": [...],
  "pagination": { "page": 2, "limit": 10, "total": 55, "totalPages": 6 }
}
```

Paginated endpoints: `/api/v1/games/history`, `/api/v1/collections/:id/games`.

## Response Compression

All API responses are gzip-compressed via `@fastify/compress` when the client sends `Accept-Encoding: gzip`. This works at the application level in addition to nginx gzip, ensuring compression even when accessing the API directly (e.g., port 3001 in dev mode).

## Request ID Tracing

Every request gets a unique ID (`reqId`) propagated through the entire async call chain via Node.js `AsyncLocalStorage`. This means:

- Fastify logs include `reqId` automatically
- Child loggers created with `createChildLogger()` auto-attach `reqId`
- Any code can call `getRequestId()` to get the current request's ID
- Enables end-to-end tracing: HTTP request → DB query → Redis call → response

## Redis Reconnect

The Redis client uses an exponential backoff reconnect strategy:

- Individual commands retry up to 3 times before throwing
- Reconnects with backoff from 200ms to 5s cap
- Gives up after 10 failed reconnect attempts
- Auto-reconnects on READONLY errors (Redis failover)

Brief Redis outages (restart, network blip) are handled transparently without manual intervention.

## Redis Clock Recovery

If Redis restarts and game clock keys (`clock:{gameId}`) are lost, the API automatically recovers from the database. `getClocksRealtime()` calls `recoverClocks(gameId)` which reconstructs clock state from the game's `initialTime` and `increment` fields. Both clocks reset to initial values (elapsed time is lost) but the game continues rather than breaking.

Implementation: `apps/api/src/lib/gameClock.ts`

## Expired Token Cleanup

The API server runs an hourly `setInterval` that deletes expired refresh tokens (`expiresAt < now()`) from the database. This prevents unbounded growth of the `RefreshToken` table from users who never explicitly log out.

Implementation: `apps/api/src/server.ts` (alongside the zombie game cleanup interval)

## Metrics Endpoints

The API exposes metrics in two formats:

- **`GET /metrics`** — Prometheus text format. This is the standard scrape target for Prometheus, returning Node.js process metrics and HTTP request histograms in the OpenMetrics text exposition format.
- **`GET /api/v1/metrics/app`** — JSON format. Returns application-level stats (`totalUsers`, `activeGames`, `analysisQueue`) as a JSON object, suitable for custom dashboards or health checks that don't use Prometheus.

See [Observability](../deployment/observability.md) for dashboard setup and metric definitions.

## Health Check

`GET /health` pings both Postgres and Redis, returning per-service status with latency.

```json
{
  "status": "ok",
  "timestamp": "2026-03-23T...",
  "services": {
    "postgres": { "status": "ok", "latencyMs": 2 },
    "redis": { "status": "ok", "latencyMs": 1 }
  }
}
```

Returns **200** when all services are healthy, **503** with `"status": "degraded"` when any service is down. Used by Docker health checks and monitoring.

## ETag Support

All GET endpoints with 200 responses include an `ETag` header (MD5 hash of the response body). Clients can send `If-None-Match` with the cached ETag to receive a `304 Not Modified` response with no body when content hasn't changed.

This reduces bandwidth for frequently polled endpoints like `/api/v1/bots`, `/api/v1/stats`, and `/api/v1/activity`.

```
GET /api/v1/bots
→ 200 OK
→ ETag: "abc123..."

GET /api/v1/bots
If-None-Match: "abc123..."
→ 304 Not Modified (no body)
```
