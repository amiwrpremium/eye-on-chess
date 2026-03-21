# Admin API

All admin endpoints require authentication + `ADMIN` role. Protected by CSRF, rate limiting, and audit logging.

## Security

- **Role check:** DB lookup on every request (not just JWT claim — handles revocation)
- **CSRF:** Double-submit cookie pattern. GET `/api/admin/csrf` to get a token, include as `X-CSRF-Token` header on mutations
- **Rate limit:** 60 requests/minute per IP
- **Audit log:** Every mutation recorded with admin, action, target, details, IP

See [Admin Security](../admin/security.md) for details.

## Endpoints

### `GET /api/admin/csrf`

Get a CSRF token. Sets `csrf_token` cookie and returns the token in the response.

### `GET /api/admin/dashboard`

**Response:**

```json
{
  "stats": {
    "totalUsers": 150,
    "activeUsers": 142,
    "totalGames": 500,
    "activeGames": 3,
    "completedGames": 480,
    "gamesToday": 12,
    "analysisQueueDepth": 0
  },
  "settings": { ... }
}
```

### `GET /api/admin/users?page=1&limit=20&search=alice&sort=createdAt&order=desc`

Paginated user list with search and sorting.

**Sortable fields:** `createdAt`, `username`, `email`, `rating`, `role`

### `PATCH /api/admin/users/:id`

Update user properties.

**Body (all optional):**

```json
{
  "active": false,
  "verified": true,
  "role": "ADMIN"
}
```

**Protections:**

- Cannot demote yourself
- Cannot deactivate yourself
- Cannot remove the last admin

### `DELETE /api/admin/users/:id`

Delete a user and all their data (cascades).

**Protections:**

- Cannot delete yourself
- Cannot delete the last admin

### `GET /api/admin/games?page=1&limit=20&status=COMPLETED&search=alice`

Paginated game list with status filter and player search.

### `DELETE /api/admin/games/:id`

Delete a game and all its moves/analysis (cascades).

### `GET /api/admin/settings`

Get site settings from DB.

### `PUT /api/admin/settings`

Update site settings. Persisted to DB (survives container restarts).

**Body (all optional):**

```json
{
  "siteName": "MyChess",
  "registrationOpen": false,
  "maxUsers": 100,
  "requireEmailVerification": true
}
```

`siteName` is sanitized and clamped to 100 characters. `maxUsers` clamped to 0-1000000.

### `GET /api/admin/audit-log?page=1&limit=50&action=user.update&adminId=clx...`

Paginated audit log with action and admin filters.

**Audit actions:** `user.update`, `user.delete`, `game.delete`, `settings.update`
