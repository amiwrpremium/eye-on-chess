# Collections API

Organize games into named collections. All endpoints require authentication.

## REST Endpoints

### `GET /api/v1/collections`

List the authenticated user's collections, ordered by creation date ascending.

**Response (200):**

```json
{
  "collections": [
    { "id": "clx...", "name": "Favorites", "gameCount": 5, "createdAt": "2026-01-01T00:00:00.000Z" }
  ]
}
```

### `POST /api/v1/collections`

Create a new collection.

**Body:**

```json
{ "name": "My Best Games" }
```

Name is trimmed and capped at 50 characters.

**Response (200):**

```json
{ "collection": { "id": "clx...", "name": "My Best Games", ... } }
```

**Errors:** `400` name is required, `409` collection with this name already exists.

### `DELETE /api/v1/collections/:id`

Delete a collection. The "Favorites" collection cannot be deleted.

**Response (200):**

```json
{ "success": true }
```

**Errors:** `404` collection not found, `403` not your collection, `400` cannot delete Favorites.

### `GET /api/v1/collections/:id/games`

Get paginated list of games in a collection.

**Query params:**

| Param   | Type   | Default | Max |
| ------- | ------ | ------- | --- |
| `page`  | number | 1       | --  |
| `limit` | number | 20      | 50  |

**Response (200):**

```json
{
  "collection": { "id": "clx...", "name": "Favorites" },
  "games": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

Each game includes: `id`, `status`, `result`, `termination`, `timeControl`, `isVsBot`, `botElo`, `createdAt`, `whiteId`, `blackId`, `white` (username, rating), `black` (username, rating).

**Errors:** `404` collection not found, `403` not your collection.

### `POST /api/v1/collections/:id/games`

Add a game to a collection. Idempotent -- adding a game that already exists returns success.

**Body:**

```json
{ "gameId": "clx..." }
```

**Response (200):**

```json
{ "success": true }
```

**Errors:** `404` collection not found, `403` not your collection.

### `DELETE /api/v1/collections/:id/games/:gameId`

Remove a game from a collection. Silently succeeds even if the game was not in the collection.

**Response (200):**

```json
{ "success": true }
```

**Errors:** `404` collection not found, `403` not your collection.

### `GET /api/v1/games/:id/collections`

Get which of the authenticated user's collections a game belongs to.

**Response (200):**

```json
{
  "collections": [{ "id": "clx...", "name": "Favorites" }]
}
```
