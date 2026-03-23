# Game Notes API

Personal notes on games. Each user can store one note per game. All endpoints require authentication.

## REST Endpoints

### `GET /api/v1/games/:id/notes`

Get the authenticated user's note for a game.

**Response (200):**

```json
{
  "note": {
    "text": "Interesting Sicilian game, should study the middlegame plan.",
    "updatedAt": "2026-03-22T10:00:00.000Z"
  }
}
```

Returns `{ "note": null }` if no note exists.

### `PUT /api/v1/games/:id/notes`

Create, update, or delete a note for a game.

**Body (create/update):**

```json
{ "text": "My notes about this game..." }
```

**Body (delete):**

```json
{ "text": "" }
```

Sending an empty or whitespace-only `text` deletes the note.

**Response (200):**

```json
{
  "note": {
    "text": "My notes about this game...",
    "updatedAt": "2026-03-22T10:05:00.000Z"
  }
}
```

Returns `{ "note": null }` when the note is deleted.

**Constraints:**

- Maximum length: 2000 characters (text is truncated if longer).
- Text is sanitized (HTML stripped) before storage.

**Errors:** `404` game not found.
