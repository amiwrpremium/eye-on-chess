# EyeOnChess - Progress Tracker

## Project Overview

Self-hostable chess platform built with Next.js 14, Fastify, PostgreSQL, Redis, and Socket.io.

## Completed Phases

### Phase 1: Project Scaffold (Complete)

- Turborepo monorepo with pnpm workspaces
- **apps/web** — Next.js 14, TypeScript, Tailwind CSS (port 3000)
- **apps/api** — Fastify, TypeScript with tsx hot reload (port 3001)
- **packages/chess** — Shared types (Color, PieceType, Piece)
- **deployment/** — Dockerfile.web, Dockerfile.api
- **docker-compose.yml** — postgres (alpine), redis (alpine), api, web
- **.env.example** — All required env vars documented
- **README.md** — Project description, requirements, 3-step setup
- `GET /health` returns `{ status: "ok", timestamp }` — verified working
- Hot reload via volume mounts for apps/ and packages/

### Phase 2: Database Schema & Prisma Setup (Complete)

- **Prisma 6** with PostgreSQL datasource in `apps/api/prisma/schema.prisma`
- **Enums:** FriendshipStatus, GameStatus, GameResult, Termination, TimeControl, MoveClassification
- **Models:** User, Friendship, Game, Move, GameAnalysis, MoveFeedback, RefreshToken
- **Migrations:** `init`, `add-refresh-tokens`
- **Seed file:** reads SEED_USER_EMAIL/USERNAME/PASSWORD from env, bcrypt hashed
- **Docker startup:** API runs `prisma migrate deploy` + `prisma db seed` before dev server

### Phase 3: Authentication (Complete)

- **Custom JWT auth** (no Auth.js — simpler for Fastify + Next.js split)
- **Backend:** register, login, refresh (token rotation), logout, me
- **Token strategy:** access (JWT 15min, memory only), refresh (hashed in DB, httpOnly cookie, 7d)
- **Frontend:** zustand store, axios interceptor (auto-refresh on 401), login/register/play pages
- **Next.js middleware:** protects /play, /friends; redirects auth users from /login|/register

### Phase 4: User Profiles & Friend System (Complete)

- **Socket.io** attached to Fastify HTTP server on port 3001
  - Auth via access token in handshake
  - Heartbeat every 20s from client refreshes Redis presence key
- **Online presence** via Redis (SETEX 30s TTL)
  - `setOnline`, `setOffline`, `isOnline`, `bulkIsOnline` helpers
  - Online status only visible to friends
- **User routes** (`src/routes/users.ts`):
  - `GET /api/users/search?q=term` — partial username match, case-insensitive, limit 20, excludes self
  - `GET /api/users/:username` — public profile with game stats (wins/losses/draws from COMPLETED games)
- **Friend routes** (`src/routes/friends.ts`):
  - `GET /api/friends` — accepted friends with isOnline boolean
  - `GET /api/friends/requests` — incoming pending requests
  - `POST /api/friends/request` — send request (prevents self-add, duplicates, allows re-request after decline)
  - `POST /api/friends/accept` — addressee only
  - `POST /api/friends/decline` — addressee only
  - `DELETE /api/friends/:friendshipId` — either party can remove
- **Frontend pages:**
  - `/profile/[username]` — public profile, stats grid, friend action button (add/pending/accept/remove)
  - `/friends` — user search (debounced), incoming requests (accept/decline), friends list (green dot online indicator, remove)
  - `/play` updated with links to profile and friends, socket connection on mount
- **Socket client** (`lib/socket.ts`): connects with token, heartbeat every 20s, disconnect on unmount

### Phase 5: Core Chessboard UI Components (Complete)

- **`<ChessBoard>`** (`src/components/ChessBoard.tsx`):
  - Wraps Chessground with React lifecycle (useRef/useEffect)
  - Props: fen, orientation, movable, lastMove, check, onMove, highlightedSquares, arrows
  - Legal move highlighting via chess.js (shows valid destinations on piece click/drag)
  - Promotion dialog: detects pawn on last rank, overlay with Q/R/B/N picker
  - Board coordinates (a-h, 1-8), responsive (fills container, square aspect ratio)
  - Chessground CSS: base + brown theme + cburnett pieces
- **`<EvaluationBar>`** (`src/components/EvaluationBar.tsx`):
  - Props: evalCP (centipawns), mate (number)
  - Vertical bar with white fill from bottom (sigmoid scaling)
  - Shows +X.X / -X.X score or M# for mate sequences
  - Score label positioned on winning side
- **`<MoveList>`** (`src/components/MoveList.tsx`):
  - Props: moves ({ply, san}[]), currentPly, onGoToPly
  - Renders as paired move numbers: `1. e4 e5  2. Nf3 Nc6`
  - Current move highlighted in blue, clickable navigation
  - Auto-scrolls to current move
- **`/board-test`** page (public, no auth):
  - Interactive board with legal moves
  - Flip orientation button
  - Sample FEN positions (starting, Italian, midgame, endgame, promotion)
  - Move navigation buttons (first/prev/next/last)
  - Eval bar with slider control (centipawns + mate mode)
  - MoveList populated from moves made on the board

### Phase 7: Real-time Human vs Human Games (Complete)

- **Game clock system** (`src/lib/gameClock.ts`):
  - Redis-stored clock state: whiteTimeLeft, blackTimeLeft, lastMoveTimestamp, turn, increment
  - On-demand elapsed time calculation (no server-side interval per game)
  - Active games tracked in Redis set for timeout detection
  - 1-second timeout check loop across all active games
- **Elo rating** (`src/lib/elo.ts`):
  - K=32, standard Elo computation on game end
  - Both players' ratings updated in DB on win/loss/draw
- **Game Socket events** (`src/lib/gameSocket.ts`):
  - `game:join` → join room, send full state (for reconnect)
  - `game:move` → server-side chess.js validation, persist Move + update Game, clock update, broadcast, endgame detection (checkmate/stalemate/draw/insufficient material)
  - `game:resign` → end game, update ratings
  - `game:draw:offer/accept/decline` → in-memory draw offer tracking
  - `game:timeout` → detected by 1s poll, ends game + updates ratings
  - `game:over` → broadcast result + rating changes to room
- **API routes** (`src/routes/games.ts`):
  - `POST /api/games/friend` → create WAITING game, random color assignment, emit challenge to friend
  - `POST /api/games/challenge/accept` → set ACTIVE, init clocks in Redis
  - `POST /api/games/challenge/decline` → delete game
  - `GET /api/games/:id` → full game state with players and moves
  - Time control presets: bullet (1+0, 2+1), blitz (3+0, 5+0, 5+3), rapid (10+0, 15+10), classical (30+0), unlimited
  - Custom time control with auto-categorization
- **Frontend — Challenge flow:**
  - `/play/friend` page — online friends list, preset grid (9 options), custom time picker
  - `ChallengePopup` component — incoming challenge modal (accept/decline)
  - Socket listeners for challenge:accepted/declined with navigation
- **Frontend — Game page** (`/game/[id]`):
  - ChessBoard with live play (movable only on your turn at latest position)
  - Player info panels (avatar initial, username, rating) top and bottom
  - `PlayerClock` component — optimistic 100ms countdown, synced on each server move, red highlight <30s
  - Move list with navigation (first/prev/next/last)
  - Draw offer/resign buttons, incoming draw accept/decline UI
  - "Reconnecting..." overlay on socket disconnect, auto-rejoin on reconnect
  - Game over modal with result description + rating changes
- Play page updated with "Challenge a Friend" button
- Middleware updated to protect /game routes

### Phase 8: Post-game Analysis Pipeline (Complete)

- **Worker service** (`deployment/Dockerfile.worker`):
  - Debian bookworm-slim base (not Alpine — needed for stockfish apt package)
  - Stockfish 15.1 installed via apt, openssl for Prisma
  - Separate docker-compose service, polls Redis queue every 2s
  - Entrypoint: `src/worker.ts`
- **Stockfish engine wrapper** (`src/lib/stockfish.ts`):
  - Child process communication via stdin/stdout UCI protocol
  - `evaluatePosition(fen, depth)` → score (centipawns), mate, bestMove
  - `evaluatePositionMultiPV(fen, depth, multiPV)` for brilliant move detection
  - 30s timeout per position
- **Move classification** (`src/lib/classify.ts`):
  - CP loss thresholds: Great 0-5, Best 0-10, Excellent 10-25, Good 25-50, Inaccuracy 50-100, Mistake 100-200, Blunder 200+
  - Forced: only 1 legal move
  - Brilliant: sacrifice + cp loss < 5 + next-best move cp loss > 150
  - Accuracy formula: avg(2 / (1 + exp(0.004 _ cpLoss)) _ 100)
- **ECO opening lookup** (`src/lib/eco.ts`):
  - ~65 common openings, longest prefix match by SAN move sequence
- **Analysis job queue** (Redis):
  - `analysis:queue` list for pending jobs
  - `analysis:status:{gameId}` → queued|processing|done|error
- **API routes** (`src/routes/analysis.ts`):
  - `POST /api/games/:id/analyze` → queue job (auth required, must be player, game must be completed)
  - `GET /api/games/:id/analysis` → returns analysis with feedback, accuracy, opening name
- **Frontend — Analysis page** (`/game/[id]/analysis`):
  - Replay board (ChessBoard, not movable, click moves to navigate)
  - EvaluationBar synced to current position
  - `EvalGraph` component — custom SVG, x=ply y=eval, white/black area fill, clickable, current ply marker
  - Move list with classification symbols (!! ! ★ ● ?! ? ??) and colors
  - Best move arrow shown for inaccuracies/mistakes/blunders
  - Summary panel: accuracy % per player, classification counts (white/black)
  - Opening name + ECO code
  - Polling for analysis status (queued/processing states)
  - "Analyze Game" button when no analysis exists, retry on error

### Key decisions

- pnpm 10.32.1 (installed via official script, not corepack)
- Node 22 (alpine) in Docker
- Fastify server wrapped in async main() (avoids top-level await CJS issue with tsx)
- Next.js dev binds to 0.0.0.0 for Docker accessibility
- `deployment/` directory (not `docker/`) for Dockerfiles
- Prisma 6 (not 7) — v7 removed `url` from schema.prisma datasource, too bleeding edge
- bcrypt for password hashing (native build approved in pnpm config)
- Seed credentials from env vars (not hardcoded)
- Custom JWT over Auth.js — natural fit for Fastify API, full control, no cross-runtime session sync
- DB-stored refresh tokens — enables session revocation, logout-all-devices capability
- Socket.io integrated directly with Fastify HTTP server (no @fastify/socket.io — package doesn't exist on npm)
- ioredis for Redis client (presence keys with SETEX TTL)
- Chessground v9 + chess.js for board UI and legal move validation
- ChessBoard component is pure UI — no game state management, just props in, moves out
- Clock: server is source of truth (Redis), client does optimistic countdown between syncs
- Elo K=32 for all games, computed on game end

- Worker uses Debian bookworm-slim (not Alpine) because stockfish isn't in Alpine repos
- Stockfish at /usr/games/stockfish, added to PATH in Dockerfile
- Analysis depth 18 (balance of speed and quality)
- Redis-based job queue (simple RPUSH/LPOP) — no external job queue dependency
- MultiPV 2 used only for brilliant move detection (evaluates position before move with 2 lines)

### Phase 9: Production-ready Self-hosting (Complete)

- **Docker production setup:**
  - `docker-compose.yml` — production with Nginx reverse proxy on port 80, health checks on all services
  - `docker-compose.dev.yml` — development with hot reload, volume mounts, direct ports
  - `deployment/Dockerfile.web.prod` — multi-stage Next.js standalone build
  - `deployment/Dockerfile.api.prod` — multi-stage API build
  - `deployment/nginx.conf` — routes /api → api, /socket.io → api (websocket upgrade), / → web
  - Health checks: postgres (pg_isready), redis (redis-cli ping), api + web + nginx (wget)
- **Schema update:**
  - User model: `verified`, `darkMode`, `boardTheme`, `pieceSet` columns
  - Migration: `20260321175924_user_preferences`
- **Backend updates:**
  - `GET /api/settings` — public endpoint: siteName, siteUrl, registrationOpen
  - `PUT /api/auth/preferences` — update darkMode, boardTheme, pieceSet (validated)
  - `GET /api/auth/me` — now returns theme preferences
  - Registration checks: REGISTRATION_OPEN, MAX_USERS, REQUIRE_EMAIL_VERIFICATION
  - Seed script creates verified admin user
- **Frontend polish:**
  - `ThemeProvider` — dark/light mode via CSS class on html element
  - `BoardThemeStyles` — 6 board themes (classic, wood, green, blue, purple, dark) via CSS overrides
  - 3 piece sets (classic, modern, minimal) via CSS filters
  - `useSettingsStore` — zustand store, synced from DB on login/fetchMe, saves to API
  - `/settings` page — dark mode toggle, board theme picker with previews, piece set picker
  - `Skeleton` components — board, move list, profile loading skeletons
  - `ErrorBoundary` — class component with friendly error message + refresh button
  - Light mode CSS overrides in globals.css
  - Play page updated with Settings link
  - Middleware updated to protect /settings route
- **Backup:** `scripts/backup.sh` — pg_dump to /backups/, gzipped, auto-rotates (keeps 7)
- **.env.example** — fully documented with comments, all variables
- **README.md** — badges (Docker, MIT, Stars), feature list, quick start, architecture diagram, full config reference, backup/restore, contributing guide
- **LICENSE** — MIT

### Open Source Release Prep (Complete)

- **Security audit:**
  - Removed hardcoded `"dev-secret"` fallback in jwt.ts — now throws if JWT_SECRET is missing
  - Verified no hardcoded passwords, test emails, or debug credentials in source
  - localhost fallbacks in source are dev-only defaults (fine for OSS)
  - `.env` in `.gitignore`, `backups/` added to `.gitignore`
- **.env.example** — fully documented with every variable: NODE*ENV, DATABASE_URL, REDIS_URL, JWT_SECRET, API_URL, NEXT_PUBLIC_API_URL, SITE_NAME, SITE_URL, REGISTRATION_OPEN, MAX_USERS, REQUIRE_EMAIL_VERIFICATION, SEED_USER*\*, STOCKFISH_PATH
- **GitHub templates:**
  - `.github/ISSUE_TEMPLATE/bug_report.md` — structured bug report with env details
  - `.github/ISSUE_TEMPLATE/feature_request.md` — problem/solution format
  - `.github/CONTRIBUTING.md` — local setup, branch naming, PR guidelines, code style, project structure
  - `.github/pull_request_template.md` — summary, changes, type, checklist
- **LICENSE** — MIT
- **README.md** — project name + tagline, badges (Docker/MIT/Stars), feature list (gameplay, analysis, social, customization, self-hosting), 5-line quick start, full env var reference table, architecture diagram, tech stack table, backup/restore instructions, contributing link

### Admin Panel (Complete)

- **Schema:**
  - `UserRole` enum (USER, ADMIN) added to User model
  - `SiteSettings` model (singleton) — siteName, registrationOpen, maxUsers, requireEmailVerification
  - `AuditLog` model — adminId, action, targetType, targetId, details (JSON), ip, indexed by adminId + createdAt
  - Migration: `20260321192321_admin_panel`
  - Seed creates admin user with ADMIN role + default SiteSettings
- **Security:**
  - `adminMiddleware` — DB role check on every request (not just JWT claim)
  - `adminRateLimit` — 60 req/min per IP, in-memory with auto-cleanup
  - `csrfProtection` — double-submit cookie pattern (cookie + X-CSRF-Token header)
  - `auditLog` — every admin mutation logged with admin, action, target, details, IP
  - `sanitizeString` — strips HTML/JS injection from inputs
  - Cannot delete/demote yourself, cannot remove last admin
  - `trustProxy: true` on Fastify for correct IP behind Nginx
- **Backend routes (`/api/admin/*`):**
  - `GET /csrf` — issue CSRF token
  - `GET /dashboard` — stats (users, games, analysis queue)
  - `GET /users` — paginated, searchable, sortable
  - `PATCH /users/:id` — activate/deactivate, verify/unverify, promote/demote
  - `DELETE /users/:id` — cascade delete with protection
  - `GET /games` — paginated, filterable by status/player
  - `DELETE /games/:id` — cascade delete
  - `GET /settings` — site settings from DB
  - `PUT /settings` — update site settings (persisted, survives restart)
  - `GET /audit-log` — paginated, filterable by action/admin
- **Registration/login now uses DB settings** (env vars are initial defaults only)
- **JWT token includes role** for frontend awareness
- **Frontend:**
  - `/admin` layout with sidebar nav (Dashboard, Users, Games, Settings, Audit Log)
  - Responsive: sidebar collapses to drawer on mobile
  - Dashboard: stat cards (users, games, queue depth)
  - Users: table with search, pagination, status badges, action buttons (activate/deactivate, verify, promote/demote, delete) with confirmation modals
  - Games: table with status filter, player search, delete with confirmation
  - Settings: form with toggles (registration, email verification), inputs (site name, max users), save button
  - Audit Log: table with action filter, timestamps, admin, target, details
  - All tables have mobile card layouts
  - Loading skeletons on all pages
  - Toast notifications for success/error
  - ConfirmModal for all destructive actions
  - Admin link (purple) only visible to ADMIN users on play page
  - `adminApi.ts` helper — auto-fetches CSRF token for mutations

### Technical Improvements (Complete)

- **WebSocket reconnection resilience:**
  - Auth as function for token refresh on each reconnect attempt
  - Exponential backoff: 1s → 10s cap, up to 10 attempts
  - Automatic token refresh on auth errors
  - CORS alignment between Socket.io and API

- **PgBouncer connection pooling:**
  - PgBouncer service (edoburu/pgbouncer:1.23.1) in both compose files
  - Transaction pooling mode, 20 default pool size, 200 max clients
  - `?pgbouncer=true` in Prisma connection strings (disables prepared statements)
  - `DIRECT_DATABASE_URL` for migrations bypassing PgBouncer
  - Config files in `deployment/pgbouncer/`

- **API versioning (`/api/v1/`):**
  - All routes registered under `/api/v1` via Fastify plugin prefix
  - Backward-compat redirect: `/api/*` → `/api/v1/*` (301)
  - Nginx routing updated for `/api/v1/`
  - Rate-limits config updated to `/api/v1/` paths

- **Zod request validation:**
  - `zod` + `fastify-type-provider-zod` for runtime request validation
  - ~30 Zod schemas in `apps/api/src/lib/schemas.ts`
  - Schemas applied to route handlers via Fastify's `schema` option
  - Custom error handler returns `{ code, error }` for validation failures
  - Manual `if (!field)` checks replaced by schema validation

- **Structured error codes:**
  - ~60 error code constants in `apps/api/src/lib/errorCodes.ts`
  - `apiError(reply, status, code, message)` helper used across all routes
  - Response format: `{ code: "AUTH_INVALID_CREDENTIALS", error: "Invalid credentials" }`
  - Domains: AUTH, GAME, FRIEND, ADMIN, COLLECTION, INVITE, ANALYSIS, NOTE
  - Backward compatible — `error` field preserved for existing clients

### Bot Personality System (Complete)

- **Chat messages**: 31 bots × 11 event types = ~350 unique messages
  - Events: gameStart, onCapture, onBeingChecked, onGivingCheck, onBlunder, onPlayerBlunder, onWinning, onLosing, onCheckmate, onCheckmated, onDraw
  - `useBotChat` hook with rate limiting (1/5s), probability gate (60%), auto-dismiss (3s)
  - `BotChatBubble` component (blue speech bubble next to bot avatar)

- **Simulated think time**: Personality-driven delays before bot moves
  - `computeThinkTime(personality, context)` — derives from existing params
  - Custom tier: 800-2800ms, Engine tier: 250-350ms, clamped [200, 4000]ms
  - Context modifiers: check +50%, losing +30%, winning -30%, blunder -40%

- **Bot reactions**: Floating emoji reactions (👍 ✨ 🤦 🤔 🤝) during games
  - `useBotReactions` hook — personality-driven probabilities
  - Reuses existing `ReactionOverlay` component
  - Rate limited: 1/8s, max 5 on screen

- **Opening preferences**: Custom-tier bots follow preferred opening sequences
  - `getOpeningMove(personality, moveHistory, isWhite)` — SAN prefix matching
  - `preferredOpenings: { asWhite: string[], asBlack: string[] }` per bot
  - Falls back to minimax when opponent deviates or sequence exhausts

- **Admin bot management**: Full CRUD via admin panel (`/admin/bots`)
  - Edit all parameters via sliders and JSON editors
  - Create/delete/enable/disable bots
  - Reseed from YAML (destructive override)
  - Seeder is non-destructive (create-only, `FORCE_RESEED=1` to override)

- **Enhanced admin dashboard**: Expanded from 7 to 17+ metrics
  - Game result distribution, time control popularity, bot vs human split
  - Top 3 most played bots, recent admin actions, site status badges
  - Online user count, new users (7d), games today/week/month

### Security Hardening (Complete)

- Postgres password from `${POSTGRES_PASSWORD}` env var (not hardcoded)
- Redis password support via `--requirepass ${REDIS_PASSWORD}`
- All dev ports bound to `127.0.0.1` except Nginx port 80
- PgBouncer userlist.txt generated dynamically from env at container startup
- `--env-file .env` in Makefile for compose variable interpolation

### v1.1.1 - v1.1.3 Bug Fixes & Hardening (Complete)

- **Bot game route split:** `/play/bot` (selection) and `/play/bot/[id]` (game) — each game has a unique URL with server game ID or offline ID. Game config passed via sessionStorage.
- **New endpoint `POST /games/:id/sync-moves`:** Batch sync all moves to existing bot game after completion. Chess.js replay validation, server-computed FEN/PGN, atomic transaction. Rate limited: 5 req/min.
- **Mid-game data loss prevention:** Game state auto-saved to localStorage every move (`eyeonchess-game-{id}`). `beforeunload` handler as backup. InProgressGame interface in offlineSync.ts.
- **Sync failure handling:** syncGameToServer saves to pending queue on failure with error toast. `retryPendingSyncs()` retries on next page load. `syncOfflineGames` returns `{ synced, failed }`.
- **Zombie game cleanup:** Server-side periodic cleanup every 5 minutes aborts bot games ACTIVE > 24 hours (status=ABORTED with endedAt).
- **Duplicate sync prevention:** Client-side sync lock prevents concurrent syncOfflineGames calls. Server-side dedup checks for existing game with matching startedAt + botElo + user. offlineId sent in sync request.
- **Rate limits:** `/api/v1/games/*/sync-moves` at 5 req/min, `/api/v1/games/sync` at 10 req/min.
- **Time control preservation:** Offline sync now passes timeControl, initialTime, increment instead of hardcoding UNLIMITED.
- **Bug fixes:**
  - All frontend API paths fixed to `/api/v1/` (14 files)
  - `crypto.randomUUID` replaced with `Math.random` for HTTP contexts
  - Game-over detection before Stockfish eval (prevents crash)
  - Login form autoComplete attributes added

### v1.1.4 — Hardening & PWA (Complete)

- **Input sanitization:** `sanitizeString()` applied to username on register and collection names on create/rename.
- **Expired token cleanup:** Hourly `setInterval` in server.ts deletes refresh tokens with `expiresAt < now()`.
- **Redis clock recovery:** `recoverClocks()` in gameClock.ts reconstructs clock state from DB when Redis keys are missing. Called automatically by `getClocksRealtime()`.
- **Content Security Policy:** Replaced `contentSecurityPolicy: false` with full directive set in Helmet config (self + unsafe-inline/eval for Next.js/Swagger compatibility).
- **Abandoned game filtering:** Game history excludes bot games stuck in ACTIVE/ABORTED without moves.
- **Bot post-game quote:** Game-over modal shows a contextual quote from the bot after bot games.
- **Client-side PGN export:** Offline bot games generate PGN locally without requiring server sync.
- **Error handling:** Bot game page wraps makeBotMove/handleMove in try-catch with 30s Stockfish timeout.
- **PWA update notification:** `useUpdateNotification` hook detects service worker updates via `controllerchange` event. Game-aware: defers reload during active bot games, auto-reloads otherwise. Deferred updates stored in sessionStorage, applied on next navigation. Integrated via `ClientProviders.tsx`.

## Current Status

- All phases complete: 1, 2, 3, 4, 5, 7, 8, 9 + release prep + admin panel + technical improvements + bot personality system + security hardening + v1.1.4 hardening & PWA
- Version 1.1.4 (packages), with 2 additional untagged commits (PWA update notification + hardening fixes)
- Note: Phase 6 was skipped (user jumped from Phase 5 to Phase 7)
