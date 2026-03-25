# Frontend Pages

All pages use the Next.js 14 App Router under `apps/web/src/app/`.

## Public Pages

| Route                | File                          | Description                                                                         |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `/`                  | `page.tsx`                    | Homepage — redirects to `/play` if logged in, otherwise shows login/register links  |
| `/login`             | `login/page.tsx`              | Email + password login form                                                         |
| `/register`          | `register/page.tsx`           | Email + username + password registration form                                       |
| `/profile/:username` | `profile/[username]/page.tsx` | Public profile — stats (wins/losses/draws), rating, join date, friend action button |
| `/board-test`        | `board-test/page.tsx`         | Component demo — interactive board, eval bar slider, move list, sample positions    |
| `/legal/terms`       | `legal/terms/page.tsx`        | Terms of Service                                                                    |
| `/legal/privacy`     | `legal/privacy/page.tsx`      | Privacy Policy                                                                      |
| `/offline`           | `offline/page.tsx`            | Offline fallback — shown by service worker when no cached page is available         |

## Protected Pages (require auth)

Redirects to `/login` if no refresh token cookie.

| Route                | File                          | Description                                                                                                                   |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/play`              | `play/page.tsx`               | Play hub — challenge friend, profile, friends, settings links. Shows admin link for admins.                                   |
| `/play/friend`       | `play/friend/page.tsx`        | Challenge a friend — online friends list, time control presets + custom picker                                                |
| `/play/bot`          | `play/bot/page.tsx`           | Bot selection — choose bot, time control, color, game mode. Retries pending syncs on mount.                                   |
| `/play/bot/[id]`     | `play/bot/[id]/page.tsx`      | Bot game — active gameplay with unique URL per game, config from sessionStorage                                               |
| `/game/:id`          | `game/[id]/page.tsx`          | Live game — board, clocks, captured pieces, player info, move list, board flip, draw/resign, reactions, reconnection handling |
| `/game/:id/analysis` | `game/[id]/analysis/page.tsx` | Post-game analysis — replay board, eval bar, eval graph, classifications, accuracy                                            |
| `/friends`           | `friends/page.tsx`            | Friends list (online indicators), incoming requests, user search                                                              |
| `/stats`             | `stats/page.tsx`              | Personal stats dashboard — rating chart, record, openings, accuracy, streaks, activity                                        |
| `/history`           | `history/page.tsx`            | Game history — paginated list of past games with result, opponent, time control, notes, and PGN export                        |
| `/collections`       | `collections/page.tsx`        | Game collection management — create, rename, delete, and browse saved game collections                                        |
| `/invites`           | `invites/page.tsx`            | Invite code management — generate, copy, and share invite codes                                                               |
| `/settings`          | `settings/page.tsx`           | Dark/light mode toggle, board theme picker (6 themes), piece set picker (3 sets)                                              |

## Admin Pages (require ADMIN role)

Redirects to `/play` if not admin. Uses `AdminLayout` with sidebar navigation.

| Route              | File                       | Description                                                                             |
| ------------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| `/admin`           | `admin/page.tsx`           | Dashboard — stat cards (users, games, queue depth)                                      |
| `/admin/users`     | `admin/users/page.tsx`     | User management — search, paginate, activate/deactivate, verify, promote/demote, delete |
| `/admin/games`     | `admin/games/page.tsx`     | Game management — search, filter by status, delete                                      |
| `/admin/settings`  | `admin/settings/page.tsx`  | Site settings — site name, registration toggle, max users, email verification           |
| `/admin/audit-log` | `admin/audit-log/page.tsx` | Audit log — filterable history of all admin actions                                     |

## Route Protection

`src/middleware.ts` uses Next.js middleware to:

- Redirect unauthenticated users away from protected routes → `/login`
- Redirect authenticated users away from `/login` and `/register` → `/play`
- Check is based on `refresh_token` cookie existence (not JWT validation — that happens API-side)

Protected route prefixes: `/play`, `/friends`, `/game`, `/history`, `/collections`, `/settings`, `/admin`
