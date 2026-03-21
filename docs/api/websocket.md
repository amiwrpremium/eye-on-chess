# WebSocket Events

Real-time communication via Socket.io on the same port as the API (3001, proxied through Nginx at `/socket.io/`).

## Connection

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  auth: { token: accessToken },
  withCredentials: true,
});
```

Authentication is required. The server verifies the JWT from `handshake.auth.token`.

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
