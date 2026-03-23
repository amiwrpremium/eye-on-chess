# Games API

## REST Endpoints (All Auth Required)

### `POST /api/v1/games/friend`

Challenge a friend to a game.

**Body (preset):**

```json
{
  "friendId": "clx...",
  "preset": "blitz_5_0"
}
```

**Body (custom):**

```json
{
  "friendId": "clx...",
  "initialTime": 600,
  "increment": 5
}
```

**Available presets:**

| Preset           | Category  | Time     |
| ---------------- | --------- | -------- |
| `bullet_1_0`     | Bullet    | 1+0      |
| `bullet_2_1`     | Bullet    | 2+1      |
| `blitz_3_0`      | Blitz     | 3+0      |
| `blitz_5_0`      | Blitz     | 5+0      |
| `blitz_5_3`      | Blitz     | 5+3      |
| `rapid_10_0`     | Rapid     | 10+0     |
| `rapid_15_10`    | Rapid     | 15+10    |
| `classical_30_0` | Classical | 30+0     |
| `unlimited`      | Unlimited | No clock |

Custom time controls are auto-categorized based on `initialTime + increment * 40`.

**Response (200):** Full game object with player details.

Creates a `WAITING` game and emits `challenge:incoming` via Socket.io.

### `POST /api/v1/games/challenge/accept`

Accept a challenge.

**Body:**

```json
{ "gameId": "clx..." }
```

Sets game to `ACTIVE`, initializes clocks in Redis, emits `challenge:accepted`.

### `POST /api/v1/games/challenge/decline`

Decline a challenge.

**Body:**

```json
{ "gameId": "clx..." }
```

Deletes the game, emits `challenge:declined`.

### `GET /api/v1/games/:id`

Get full game state including players and moves.

### `POST /api/v1/games/bot`

Create a bot game.

**Body (preset):**

```json
{
  "botElo": 1200,
  "color": "white",
  "preset": "blitz_5_0"
}
```

**Body (custom):**

```json
{
  "botElo": 1200,
  "color": "random",
  "initialTime": 600,
  "increment": 5
}
```

| Field         | Type                                 | Required | Notes                                         |
| ------------- | ------------------------------------ | -------- | --------------------------------------------- |
| `botElo`      | number                               | Yes      | 200 -- 3200                                   |
| `color`       | `"white"` \| `"black"` \| `"random"` | Yes      | Player's color                                |
| `preset`      | string                               | No       | Same presets as friend challenge              |
| `initialTime` | number (seconds)                     | No       | Required if no preset (defaults to 600 Rapid) |
| `increment`   | number (seconds)                     | No       | Defaults to 0                                 |

**Response (200):**

```json
{
  "game": { ... },
  "botFirstMove": { "from": "e2", "to": "e4", "san": "e4", "fen": "...", "ply": 1 },
  "playerIsWhite": true
}
```

`botFirstMove` is non-null when the bot plays white and makes the opening move immediately.

### `POST /api/v1/games/:id/move`

Make a move in a bot game. The server validates the player's move, applies it, then computes and applies the bot's response in the same request.

**Body:**

```json
{ "from": "e2", "to": "e4", "promotion": "q" }
```

`promotion` is optional (only needed for pawn promotion).

**Response (200):**

```json
{
  "playerMove": { "from": "e2", "to": "e4", "san": "e4", "fen": "...", "ply": 1 },
  "botMove": { "from": "e7", "to": "e5", "san": "e5", "fen": "...", "ply": 2 },
  "gameOver": null,
  "clocks": { "whiteTimeLeft": 300000, "blackTimeLeft": 300000 }
}
```

When the game ends (after either the player's or bot's move), `gameOver` contains `{ result, termination }` and `botMove` may be `null`.

**Errors:** `404` game not found, `400` game not active / not a bot game / not your turn / invalid move, `403` not your game.

### `POST /api/v1/games/:id/resign`

Resign a bot game.

**Response (200):**

```json
{ "result": "BLACK_WIN", "termination": "RESIGNATION" }
```

The result reflects the opponent winning (if you are white, result is `BLACK_WIN`).

### `POST /api/v1/games/sync`

Sync an offline bot game to the server. The server replays all moves to validate them, then creates the game and move records.

**Body:**

```json
{
  "botElo": 1200,
  "playerIsWhite": true,
  "moves": [
    { "ply": 1, "san": "e4", "uci": "e2e4", "fen": "..." },
    { "ply": 2, "san": "e5", "uci": "e7e5", "fen": "..." }
  ],
  "result": "WHITE_WIN",
  "termination": "CHECKMATE",
  "startedAt": "2026-03-22T10:00:00.000Z",
  "endedAt": "2026-03-22T10:15:00.000Z"
}
```

**Response (200):**

```json
{ "success": true, "gameId": "clx..." }
```

The synced game is always stored as `UNLIMITED` time control with `isVsBot: true`.

### `GET /api/v1/games/:id/pgn`

Export a game as a PGN file.

**Response:** `text/plain` with `Content-Disposition: attachment` header. Includes standard PGN headers (Event, Site, Date, White, Black, Result, WhiteElo, BlackElo, TimeControl, Termination) followed by the move text.

### `GET /api/v1/games/active`

Get the authenticated user's currently active game (if any).

**Response (200):**

```json
{ "game": { ... } }
```

Returns `{ "game": null }` if no active game exists. The game object includes players and moves.

### `GET /api/v1/games/history`

Get paginated game history for the authenticated user (completed and aborted games).

**Query params:**

| Param   | Type   | Default | Max |
| ------- | ------ | ------- | --- |
| `page`  | number | 1       | --  |
| `limit` | number | 20      | 50  |

**Response (200):**

```json
{
  "games": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

## Rematch Flow (Socket.io)

After a game ends, either player can offer a rematch. Colors are swapped in the new game.

| Direction | Event                  | Payload                                               | Description                |
| --------- | ---------------------- | ----------------------------------------------------- | -------------------------- |
| C -> S    | `game:rematch:offer`   | `gameId` (string)                                     | Offer a rematch            |
| S -> C    | `game:rematch:offered` | `{ by, gameId, timeControl, initialTime, increment }` | Rematch was offered        |
| C -> S    | `game:rematch:accept`  | `gameId` (string)                                     | Accept the rematch         |
| S -> C    | `game:rematch:started` | `{ newGameId }`                                       | New game created, redirect |

The original game must be `COMPLETED`. The new game is created with the same time control and swapped colors.

## Emoji Reactions (Socket.io)

Players can send emoji reactions during active games.

| Direction | Event           | Payload                |
| --------- | --------------- | ---------------------- |
| C -> S    | `game:reaction` | `{ gameId, reaction }` |
| S -> C    | `game:reaction` | `{ userId, reaction }` |

**Valid reactions:** `good_move`, `brilliant`, `blunder`, `thinking`, `gg`, `takeback`

**Rate limiting:** 5 reactions per 10 seconds per user per game. Excess reactions are silently dropped.

## Clock System

- **Source of truth:** Redis (not the database)
- **Storage:** `whiteTimeLeft`, `blackTimeLeft`, `lastMoveTimestamp`, `turn`, `increment`
- **On each move:** server computes elapsed time, deducts from moving player, adds increment
- **Timeout detection:** 1-second poll loop checks all active games
- **Client:** optimistic countdown (100ms interval), synced on each server move event

## Elo Rating

Standard Elo with K=32. Updated on game completion (not aborted games, not bot games).

```
expectedScore = 1 / (1 + 10^((opponentRating - playerRating) / 400))
newRating = oldRating + K * (actualScore - expectedScore)
```
