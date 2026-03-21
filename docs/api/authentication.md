# Authentication API

Custom JWT-based authentication with access token + httpOnly refresh cookie rotation.

## Endpoints

### `POST /api/auth/register`

Create a new account.

**Body:**

```json
{
  "email": "user@example.com",
  "username": "player1",
  "password": "minimum8chars"
}
```

**Validation:**

- Email must be unique
- Username must be unique
- Password must be at least 8 characters
- Registration must be open (checked against DB settings)
- User limit must not be reached

**Response (200):**

```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "username": "player1",
    "rating": 1200,
    "role": "USER"
  }
}
```

Also sets `refresh_token` httpOnly cookie.

**Errors:** `400` (validation), `403` (registration closed/limit), `409` (duplicate)

### `POST /api/auth/login`

**Body:**

```json
{
  "email": "user@example.com",
  "password": "minimum8chars"
}
```

**Checks:** credentials, active status, email verification (if enabled)

**Response:** Same as register.

**Errors:** `401` (invalid credentials), `403` (deactivated/unverified)

### `POST /api/auth/refresh`

Uses the `refresh_token` httpOnly cookie. No body required.

- Validates token against DB (SHA-256 hashed)
- Deletes old token, creates new one (rotation)
- Returns new access token + sets new cookie

**Response (200):**

```json
{ "accessToken": "eyJ..." }
```

**Errors:** `401` (missing/invalid/expired token)

### `POST /api/auth/logout`

Deletes refresh token from DB and clears cookie.

**Response (200):**

```json
{ "success": true }
```

### `GET /api/auth/me` (Auth required)

Returns current user profile including preferences.

**Response (200):**

```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "username": "player1",
    "rating": 1200,
    "avatarUrl": null,
    "role": "USER",
    "darkMode": true,
    "boardTheme": "classic",
    "pieceSet": "classic",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### `PUT /api/auth/preferences` (Auth required)

Update theme preferences. Saved to DB.

**Body (all optional):**

```json
{
  "darkMode": false,
  "boardTheme": "green",
  "pieceSet": "modern"
}
```

**Valid board themes:** `classic`, `wood`, `green`, `blue`, `purple`, `dark`

**Valid piece sets:** `classic`, `modern`, `minimal`

## Token Strategy

| Token   | Type               | Lifetime   | Storage                                      |
| ------- | ------------------ | ---------- | -------------------------------------------- |
| Access  | JWT (HS256)        | 15 minutes | Memory (Zustand)                             |
| Refresh | Random 40-byte hex | 7 days     | httpOnly cookie (browser), SHA-256 hash (DB) |

- Refresh tokens are **rotated** on each use (old deleted, new created)
- Access tokens include: `userId`, `email`, `username`, `role`
- Cookies: `httpOnly`, `secure` (production), `sameSite: lax`, `path: /`

## Auto-Refresh (Frontend)

The Axios interceptor in `lib/api.ts`:

1. Catches any 401 response
2. Calls `/api/auth/refresh`
3. Retries the original request with the new token
4. Queues concurrent requests during refresh (no thundering herd)
5. If refresh fails → clears state → redirects to `/login`
