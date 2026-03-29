# Admin Security

The admin panel implements multiple layers of security.

## Authentication & Authorization

Every admin API request passes through:

1. **`authMiddleware`** — verifies JWT access token
2. **`adminMiddleware`** — queries the database to verify `role: ADMIN` and `active: true`
3. **`adminRateLimit`** — enforces per-IP rate limits
4. **`csrfProtection`** — validates CSRF token on mutations

The role check hits the database on every request (not cached from the JWT). This means if an admin is demoted or deactivated, they lose access immediately — even if their JWT hasn't expired.

## CSRF Protection

Uses the **double-submit cookie** pattern:

1. Frontend calls `GET /api/v1/admin/csrf` — server sets `csrf_token` cookie and returns the token
2. Frontend includes the token as `X-CSRF-Token` header on all mutations (POST, PUT, PATCH, DELETE)
3. Server compares the header value against the cookie value

The cookie is:

- `httpOnly: false` (must be readable by JavaScript)
- `secure: true` in production
- `sameSite: strict`
- 1 hour expiry

GET requests are exempt from CSRF checks.

## Rate Limiting

In-memory rate limiter:

- **60 requests per minute** per IP address
- Returns `429 Too Many Requests` when exceeded
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Stale entries cleaned up every 5 minutes

## Audit Logging

Every admin mutation is logged to the `AuditLog` table with:

| Field        | Description                                        |
| ------------ | -------------------------------------------------- |
| `adminId`    | Who performed the action                           |
| `action`     | What was done (e.g., `user.update`, `game.delete`) |
| `targetType` | Type of entity (user, game, settings)              |
| `targetId`   | ID of the affected entity                          |
| `details`    | JSON with the specific changes made                |
| `ip`         | Client IP address                                  |
| `createdAt`  | Timestamp                                          |

### Logged Actions

| Action            | When                                     |
| ----------------- | ---------------------------------------- |
| `user.update`     | Activate/deactivate, verify, role change |
| `user.delete`     | User deleted                             |
| `game.delete`     | Game deleted                             |
| `settings.update` | Site settings changed                    |
| `bot.create`      | Bot created                              |
| `bot.update`      | Bot updated                              |
| `bot.delete`      | Bot deleted                              |
| `bot.reseed`      | Bots reseeded from YAML                  |

## Self-Protection

The following operations are prevented:

| Action              | Protection                          |
| ------------------- | ----------------------------------- |
| Demote yourself     | `400: Cannot demote yourself`       |
| Deactivate yourself | `400: Cannot deactivate yourself`   |
| Delete yourself     | `400: Cannot delete yourself`       |
| Remove last admin   | `400: Cannot remove the last admin` |
| Delete last admin   | `400: Cannot delete the last admin` |

## Input Sanitization

All text inputs in admin routes are sanitized:

- HTML tags stripped (`<`, `>` removed)
- `javascript:` URIs removed
- Inline event handlers removed (`onclick=`, etc.)
- Strings trimmed

## Trust Proxy

Fastify is configured with `trustProxy: true` so that `request.ip` returns the real client IP (from `X-Forwarded-For`) rather than the Docker network IP.
