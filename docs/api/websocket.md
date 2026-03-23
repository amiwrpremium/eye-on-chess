# WebSocket Events

Real-time communication via Socket.io on the same port as the API (3001, proxied through Nginx at `/socket.io/`).

## Connection

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost", {
  auth: (cb) => cb({ token: getAccessToken() }),
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
});
```

Authentication is required. The server verifies the JWT from `handshake.auth.token`.

### Reconnection Resilience

- **Auth as function**: The `auth` callback is called on every reconnect attempt, fetching a fresh access token. This handles JWT expiry during disconnections (15min token lifetime).
- **Exponential backoff**: Reconnects with 1s → 10s delay, up to 10 attempts.
- **Token refresh on error**: If reconnect fails with "Invalid token", the client triggers a token refresh via `/api/auth/refresh` before the next attempt.
- **Game room re-join**: The game page automatically re-emits `game:join` on reconnect to restore game state.
- **CORS**: Socket.io CORS matches the API CORS whitelist (SITE_URL in production, localhost in dev).

## Presence Events

### Client → Server

| Event       | Payload | Description                              |
| ----------- | ------- | ---------------------------------------- |
| `heartbeat` | —       | Refresh online presence (send every 20s) |

### Server Behavior

On `connection`: sets user online in Redis (30s TTL)
On `heartbeat`: refreshes Redis TTL
On `disconnect`: removes Redis key

## Challenge Events

### Server → Client (broadcast)

| Event                | Payload                                                                                 | Description                 |
| -------------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| `challenge:incoming` | `{ gameId, challenger: { id, username, rating }, timeControl, initialTime, increment }` | Someone challenged you      |
| `challenge:accepted` | `{ gameId }`                                                                            | Your challenge was accepted |
| `challenge:declined` | `{ gameId }`                                                                            | Your challenge was declined |

## Game Events

### Client → Server

| Event               | Payload                            | Description                                      |
| ------------------- | ---------------------------------- | ------------------------------------------------ |
| `game:join`         | `gameId` (string)                  | Join a game room (required for receiving events) |
| `game:move`         | `{ gameId, from, to, promotion? }` | Make a move                                      |
| `game:resign`       | `gameId` (string)                  | Resign the game                                  |
| `game:draw:offer`   | `gameId` (string)                  | Offer a draw                                     |
| `game:draw:accept`  | `gameId` (string)                  | Accept a draw offer                              |
| `game:draw:decline` | `gameId` (string)                  | Decline a draw offer                             |

### Server → Client (room broadcast)

| Event                | Payload                                                   | Description                               |
| -------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `game:state`         | `{ game, clocks }`                                        | Full game state (sent on join/reconnect)  |
| `game:moved`         | `{ from, to, promotion, san, fen, ply, clocks }`          | A move was made                           |
| `game:over`          | `{ result, termination, ratingChange: { white, black } }` | Game ended                                |
| `game:draw:offered`  | `{ by: userId }`                                          | Draw was offered                          |
| `game:draw:declined` | —                                                         | Draw was declined                         |
| `game:error`         | `{ message }`                                             | Error (not your turn, invalid move, etc.) |

## Rematch Events

### Client -> Server

| Event                 | Payload           | Description      |
| --------------------- | ----------------- | ---------------- |
| `game:rematch:offer`  | `gameId` (string) | Offer a rematch  |
| `game:rematch:accept` | `gameId` (string) | Accept a rematch |

### Server -> Client (room broadcast)

| Event                  | Payload                                               | Description                       |
| ---------------------- | ----------------------------------------------------- | --------------------------------- |
| `game:rematch:offered` | `{ by, gameId, timeControl, initialTime, increment }` | A rematch was offered             |
| `game:rematch:started` | `{ newGameId }`                                       | New game created (colors swapped) |

The original game must be `COMPLETED`. The new game uses the same time control with colors swapped.

## Emoji Reactions

### Client -> Server

| Event           | Payload                | Description     |
| --------------- | ---------------------- | --------------- |
| `game:reaction` | `{ gameId, reaction }` | Send a reaction |

### Server -> Client (room broadcast)

| Event           | Payload                | Description         |
| --------------- | ---------------------- | ------------------- |
| `game:reaction` | `{ userId, reaction }` | A reaction was sent |

**Valid reactions:** `good_move`, `brilliant`, `blunder`, `thinking`, `gg`, `takeback`

**Rate limiting:** 5 reactions per 10 seconds per user per game. Excess reactions are silently dropped. Only active game participants can send reactions.

## Game Flow

```
Client A                    Server                    Client B
   |                          |                          |
   |-- game:join(id) -------->|                          |
   |<-- game:state -----------|                          |
   |                          |<-------- game:join(id) --|
   |                          |---------- game:state --->|
   |                          |                          |
   |-- game:move ------------>|                          |
   |<-- game:moved -----------|---------- game:moved --->|
   |                          |                          |
   |                          |<--------- game:move ----|
   |<-- game:moved -----------|---------- game:moved --->|
   |                          |                          |
   |-- game:resign ---------->|                          |
   |<-- game:over ------------|----------- game:over --->|
```

## Reconnection

If the socket disconnects and reconnects:

1. Client re-emits `game:join` with the game ID
2. Server sends `game:state` with the full current state
3. Client updates its local state to match

The frontend shows a "Reconnecting..." overlay during disconnection.
