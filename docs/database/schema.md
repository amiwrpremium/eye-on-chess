# Database Schema

PostgreSQL database managed by Prisma ORM. Schema defined in `apps/api/prisma/schema.prisma`.

## Enums

| Enum                 | Values                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `UserRole`           | `USER`, `ADMIN`                                                                                 |
| `FriendshipStatus`   | `PENDING`, `ACCEPTED`, `DECLINED`                                                               |
| `GameStatus`         | `WAITING`, `ACTIVE`, `COMPLETED`, `ABORTED`                                                     |
| `GameResult`         | `WHITE_WIN`, `BLACK_WIN`, `DRAW`, `ABORTED`                                                     |
| `Termination`        | `CHECKMATE`, `RESIGNATION`, `TIMEOUT`, `AGREEMENT`                                              |
| `TimeControl`        | `BULLET`, `BLITZ`, `RAPID`, `CLASSICAL`, `UNLIMITED`                                            |
| `MoveClassification` | `BRILLIANT`, `GREAT`, `BEST`, `EXCELLENT`, `GOOD`, `INACCURACY`, `MISTAKE`, `BLUNDER`, `FORCED` |

## Models

### User

| Field          | Type          | Notes              |
| -------------- | ------------- | ------------------ |
| `id`           | String (cuid) | Primary key        |
| `email`        | String        | Unique             |
| `username`     | String        | Unique             |
| `passwordHash` | String        | bcrypt (12 rounds) |
| `avatarUrl`    | String?       |                    |
| `rating`       | Int           | Default: 1200      |
| `role`         | UserRole      | Default: USER      |
| `active`       | Boolean       | Default: true      |
| `verified`     | Boolean       | Default: false     |
| `darkMode`     | Boolean       | Default: true      |
| `boardTheme`   | String        | Default: "classic" |
| `pieceSet`     | String        | Default: "classic" |
| `createdAt`    | DateTime      | Auto               |
| `updatedAt`    | DateTime      | Auto               |

**Relations:** games (white/black), friendships (requester/addressee), refresh tokens, audit logs

### RefreshToken

| Field       | Type          | Notes                      |
| ----------- | ------------- | -------------------------- |
| `id`        | String (cuid) | Primary key                |
| `userId`    | String        | FK → User (cascade delete) |
| `token`     | String        | Unique, SHA-256 hashed     |
| `expiresAt` | DateTime      |                            |
| `createdAt` | DateTime      | Auto                       |

**Indexes:** `userId`, `token`

### Friendship

| Field         | Type             | Notes            |
| ------------- | ---------------- | ---------------- |
| `id`          | String (cuid)    | Primary key      |
| `requesterId` | String           | FK → User        |
| `addresseeId` | String           | FK → User        |
| `status`      | FriendshipStatus | Default: PENDING |

**Unique constraint:** `[requesterId, addresseeId]`

### Game

| Field           | Type          | Notes                      |
| --------------- | ------------- | -------------------------- |
| `id`            | String (cuid) | Primary key                |
| `whiteId`       | String?       | FK → User                  |
| `blackId`       | String?       | FK → User                  |
| `status`        | GameStatus    | Default: WAITING           |
| `result`        | GameResult?   |                            |
| `termination`   | Termination?  |                            |
| `pgn`           | String        | Default: ""                |
| `fen`           | String        | Default: starting position |
| `timeControl`   | TimeControl   | Default: RAPID             |
| `initialTime`   | Int           | Seconds. Default: 600      |
| `increment`     | Int           | Seconds. Default: 0        |
| `whiteTimeLeft` | Int?          | Milliseconds               |
| `blackTimeLeft` | Int?          | Milliseconds               |
| `isVsBot`       | Boolean       | Default: false             |
| `botElo`        | Int?          |                            |

**Relations:** moves, analysis

### Move

| Field       | Type          | Notes                       |
| ----------- | ------------- | --------------------------- |
| `id`        | String (cuid) | Primary key                 |
| `gameId`    | String        | FK → Game (cascade delete)  |
| `ply`       | Int           | Move number (1-based)       |
| `san`       | String        | Standard algebraic notation |
| `uci`       | String        | UCI format (e.g., "e2e4")   |
| `fen`       | String        | Position after this move    |
| `timeTaken` | Int?          | Milliseconds                |

**Index:** `gameId`

### GameAnalysis

| Field           | Type          | Notes                             |
| --------------- | ------------- | --------------------------------- |
| `id`            | String (cuid) | Primary key                       |
| `gameId`        | String        | Unique FK → Game (cascade delete) |
| `whiteAccuracy` | Float?        | Percentage                        |
| `blackAccuracy` | Float?        | Percentage                        |

One-to-one with Game.

### MoveFeedback

| Field            | Type               | Notes                              |
| ---------------- | ------------------ | ---------------------------------- |
| `id`             | String (cuid)      | Primary key                        |
| `analysisId`     | String             | FK → GameAnalysis (cascade delete) |
| `moveId`         | String             | Unique FK → Move (cascade delete)  |
| `ply`            | Int                |                                    |
| `classification` | MoveClassification |                                    |
| `bestMove`       | String?            | UCI format                         |
| `evalBefore`     | Int?               | Centipawns                         |
| `evalAfter`      | Int?               | Centipawns                         |

**Index:** `analysisId`

### SiteSettings

Singleton table (always has id `"singleton"`).

| Field                      | Type     | Notes                  |
| -------------------------- | -------- | ---------------------- |
| `id`                       | String   | Default: "singleton"   |
| `siteName`                 | String   | Default: "EyeOnChess"  |
| `registrationOpen`         | Boolean  | Default: true          |
| `maxUsers`                 | Int      | Default: 0 (unlimited) |
| `requireEmailVerification` | Boolean  | Default: false         |
| `updatedAt`                | DateTime | Auto                   |

### AuditLog

| Field        | Type          | Notes               |
| ------------ | ------------- | ------------------- |
| `id`         | String (cuid) | Primary key         |
| `adminId`    | String        | FK → User           |
| `action`     | String        | e.g., "user.update" |
| `targetType` | String        | e.g., "user"        |
| `targetId`   | String?       |                     |
| `details`    | String?       | JSON string         |
| `ip`         | String?       |                     |
| `createdAt`  | DateTime      | Auto                |

**Indexes:** `adminId`, `createdAt`

## Entity Relationship Diagram

```
User ──1:N──> RefreshToken
User ──1:N──> Friendship (as requester)
User ──1:N──> Friendship (as addressee)
User ──1:N──> Game (as white)
User ──1:N──> Game (as black)
User ──1:N──> AuditLog

Game ──1:N──> Move
Game ──1:1──> GameAnalysis

Move ──1:1──> MoveFeedback
GameAnalysis ──1:N──> MoveFeedback
```
