# Admin API

All admin endpoints require authentication + `ADMIN` role. Protected by CSRF, rate limiting, and audit logging.

## Security

- **Role check:** DB lookup on every request (not just JWT claim — handles revocation)
- **CSRF:** Double-submit cookie pattern. GET `/api/v1/admin/csrf` to get a token, include as `X-CSRF-Token` header on mutations
- **Rate limit:** 60 requests/minute per IP
- **Audit log:** Every mutation recorded with admin, action, target, details, IP

See [Admin Security](../admin/security.md) for details.

## Endpoints

### `GET /api/v1/admin/csrf`

Get a CSRF token. Sets `csrf_token` cookie and returns the token in the response.

### `GET /api/v1/admin/dashboard`

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

### `GET /api/v1/admin/users?page=1&limit=20&search=alice&sort=createdAt&order=desc`

Paginated user list with search and sorting.

**Sortable fields:** `createdAt`, `username`, `email`, `rating`, `role`

### `POST /api/v1/admin/users`

Create a new user with a server-generated password.

**Body:**

```json
{
  "username": "alice",
  "email": "alice@example.com"
}
```

**Response:**

```json
{
  "user": { "id": "clx...", "username": "alice", "email": "alice@example.com" },
  "generatedPassword": "aB3x...random"
}
```

The generated password is returned only once in the response. The admin must share it with the user securely. The user is created with `role: USER`, `active: true`, and `verified: true`.

### `PATCH /api/v1/admin/users/:id`

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

### `DELETE /api/v1/admin/users/:id`

Delete a user and all their data (cascades).

**Protections:**

- Cannot delete yourself
- Cannot delete the last admin

### `GET /api/v1/admin/games?page=1&limit=20&status=COMPLETED&search=alice`

Paginated game list with status filter and player search.

### `DELETE /api/v1/admin/games/:id`

Delete a game and all its moves/analysis (cascades).

### `GET /api/v1/admin/settings`

Get site settings from DB.

### `PUT /api/v1/admin/settings`

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

### `GET /api/v1/admin/audit-log?page=1&limit=50&action=user.update&adminId=clx...`

Paginated audit log with action and admin filters.

**Audit actions:** `user.update`, `user.delete`, `game.delete`, `settings.update`
