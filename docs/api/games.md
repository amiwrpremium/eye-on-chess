# Games API

## REST Endpoints (All Auth Required)

### `POST /api/games/friend`

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

### `POST /api/games/challenge/accept`

Accept a challenge.

**Body:**

```json
{ "gameId": "clx..." }
```

Sets game to `ACTIVE`, initializes clocks in Redis, emits `challenge:accepted`.

### `POST /api/games/challenge/decline`

Decline a challenge.

**Body:**

```json
{ "gameId": "clx..." }
```

Deletes the game, emits `challenge:declined`.

### `GET /api/games/:id`

Get full game state including players and moves.

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
