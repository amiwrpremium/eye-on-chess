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

This reduces bandwidth for frequently polled endpoints like `/api/bots`, `/api/stats`, and `/api/activity`.

```
GET /api/bots
→ 200 OK
→ ETag: "abc123..."

GET /api/bots
If-None-Match: "abc123..."
→ 304 Not Modified (no body)
```
