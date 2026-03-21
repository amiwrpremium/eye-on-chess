# Users & Friends API

## User Endpoints

### `GET /api/users/:username`

Public user profile with game statistics.

**Response (200):**

```json
{
  "user": {
    "id": "clx...",
    "username": "player1",
    "rating": 1350,
    "avatarUrl": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "stats": {
      "wins": 15,
      "losses": 8,
      "draws": 3,
      "total": 26
    }
  }
}
```

Stats are computed from completed games only.

### `GET /api/users/search?q=term` (Auth required)

Search users by partial username (case-insensitive). Excludes the current user.

**Query params:** `q` (required, min 1 char)

**Response (200):**

```json
{
  "users": [{ "id": "clx...", "username": "alice", "rating": 1200, "avatarUrl": null }]
}
```

Limit: 20 results.

## Friend Endpoints (All Auth Required)

### `GET /api/friends`

List accepted friends with online status.

**Response (200):**

```json
{
  "friends": [
    {
      "friendshipId": "clx...",
      "id": "clx...",
      "username": "alice",
      "rating": 1200,
      "avatarUrl": null,
      "isOnline": true
    }
  ]
}
```

Online status checked via Redis (30s TTL presence keys).

### `GET /api/friends/requests`

List incoming pending friend requests.

**Response (200):**

```json
{
  "requests": [
    {
      "friendshipId": "clx...",
      "id": "clx...",
      "username": "bob",
      "rating": 1200,
      "avatarUrl": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/friends/request`

Send a friend request.

**Body:**

```json
{ "username": "alice" }
```

**Checks:** cannot self-add, no duplicate requests, allows re-request after decline.

### `POST /api/friends/accept`

Accept a friend request. Must be the addressee.

**Body:**

```json
{ "friendshipId": "clx..." }
```

### `POST /api/friends/decline`

Decline a friend request. Must be the addressee.

**Body:**

```json
{ "friendshipId": "clx..." }
```

### `DELETE /api/friends/:friendshipId`

Remove a friend. Either party can remove.
