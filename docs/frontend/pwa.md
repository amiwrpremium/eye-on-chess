# PWA and Offline Features

EyeOnChess is a Progressive Web App (PWA) that supports offline play and installability.

## Service Worker

The app uses [next-pwa](https://github.com/shadowwalker/next-pwa) to generate and manage a service worker. Configuration is in `apps/web/next.config.js`.

The service worker is **disabled in development** (`NODE_ENV=development`) and only active in production builds. This prevents caching interference during hot-reload development.

### Caching Strategies

| Asset Type       | Strategy                   | TTL       | Cache Name         |
| ---------------- | -------------------------- | --------- | ------------------ |
| Pages (HTML)     | NetworkFirst (5s timeout)  | 24 hours  | `pages`            |
| JS / CSS         | StaleWhileRevalidate       | 7 days    | `static-resources` |
| Images           | CacheFirst                 | 30 days   | `images`           |
| WASM (Stockfish) | CacheFirst                 | 90 days   | `wasm`             |
| Sounds           | CacheFirst                 | 90 days   | `sounds`           |
| Fonts            | CacheFirst                 | 1 year    | `fonts`            |
| API calls        | NetworkFirst (10s timeout) | 5 minutes | `api-cache`        |

### Offline Fallback

When a page navigation fails (no network, no cache), the service worker serves `/offline` — a dedicated offline page that directs users to bot play.

## Offline Bot Play

Stockfish WASM runs entirely in the browser, enabling bot games without a network connection:

- The Stockfish WASM binary (~7MB) is cached after first download via the CacheFirst strategy.
- All game logic (move validation, position evaluation) runs locally via chess.js and Stockfish.
- No server round-trip is required during a bot game.
- Game mode presets (Challenge, Friendly, Assisted, Custom) all work offline.

## Offline UI Behavior

When the device is offline, the play page adapts automatically:

- **Available offline:** Play vs Bot (with "(offline)" label), Settings
- **Grayed out and disabled:** Challenge a Friend, Game History, Stats, Collections, My Profile, Invites, Friends, Admin Panel, Log Out
- **Hidden:** Activity feed
- **Online indicator:** Red dot with "Offline" label shown at the bottom

All features re-enable automatically when the connection returns — the `useOnlineStatus` hook reacts to browser `online`/`offline` events in real time.

## Offline Game Storage

Games played offline are stored in `localStorage`:

- Completed bot games are saved locally with full move history.
- When the app detects a network connection, stored games are automatically synced to the server via `POST /api/games/sync`.
- The pending game count is shown on the bot game page.

## Auto-Sync

When connectivity resumes:

- Pending game results are uploaded to the server.
- Games that fail to sync remain in localStorage for the next attempt.
- The sync process runs automatically without user intervention.

## Install Prompt (Add to Home Screen)

The app meets PWA installability criteria and can be installed on supported devices:

- A web app manifest (`public/manifest.json`) provides app metadata (name, icons, theme color, display mode).
- PWA icons are provided at 192x192 and 512x512 (including maskable).
- On compatible browsers, users see an "Install App" button on the play page.
- Once installed, the app launches in standalone mode without browser chrome.
