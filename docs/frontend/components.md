# Frontend Components

All components are in `apps/web/src/components/`.

## Chess Components

### `ChessBoard`

Wraps [Chessground](https://github.com/lichess-org/chessground) with React lifecycle.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `fen` | `string` | Current position in FEN notation |
| `orientation` | `'white' \| 'black'` | Board orientation |
| `movable` | `boolean` | Whether pieces can be moved |
| `lastMove` | `[string, string]?` | Highlight last move (from, to) |
| `check` | `boolean?` | Highlight king in check |
| `onMove` | `(from, to, promotion?) => void` | Move callback |
| `highlightedSquares` | `{ square, color }[]?` | Custom square highlights |
| `arrows` | `{ from, to, color }[]?` | Draw arrows on board |

Features:

- Legal move highlighting via chess.js
- Promotion dialog (Q/R/B/N picker overlay)
- Board coordinates (a-h, 1-8)
- Responsive (fills container, square aspect ratio)
- Drag and click to move

### `EvaluationBar`

Vertical evaluation bar showing position advantage.

**Props:** `evalCP: number | null`, `mate: number | null`

- White fill from bottom, sigmoid scaling (-500 to +500 cp range)
- Shows `+X.X` / `-X.X` score or `M#` for mate
- Score label positioned on the winning side

### `EvalGraph`

Custom SVG evaluation graph for analysis.

**Props:** `points: { ply, eval, mate }[]`, `currentPly: number`, `onClickPly: (ply) => void`

- White/black area fill above/below zero line
- Clickable to navigate to any position
- Current ply marker (vertical yellow line)

### `MoveList`

Move notation list with navigation.

**Props:** `moves: { ply, san }[]`, `currentPly: number`, `onGoToPly: (ply) => void`

- Paired format: `1. e4 e5  2. Nf3 Nc6`
- Current move highlighted in blue
- Clickable navigation, auto-scrolls

### `PlayerClock`

Game clock with optimistic countdown.

**Props:** `timeMs: number`, `isActive: boolean`, `isRunning: boolean`

- 100ms countdown interval when active
- Red background when < 30 seconds
- Synced on each server move event

## Reaction Components

### `ReactionPicker`

Emoji reaction buttons for live games. Displays a row of selectable reaction emojis that are broadcast to the opponent via WebSocket.

### `ReactionOverlay`

Floating animated reaction bubbles. Renders incoming and outgoing reactions as animated overlays that float up and fade out over the board.

## Game Components

### `BotSelector`

Scrollable grid of bot personality cards grouped by skill category (Beginner through Grandmaster). Each category has a sticky header with Elo range, followed by cards showing the bot's emoji avatar, name, Elo badge (color-coded by Elo band), and a short description. The selected bot receives a colored ring matching its Elo band.

**Props:** `selected: BotPersonality | null`, `onSelect: (bot) => void`, `bots: BotPersonality[]`

### `CapturedPieces`

Displays a row of Unicode piece symbols representing pieces captured by one side. Compares the current board position (via FEN) against starting piece counts to compute which opponent pieces are missing. Returns null if no pieces have been captured.

**Props:** `fen: string`, `color: 'white' | 'black'`

### `GameOverModal`

Game result display with rematch flow. Shows the outcome (win/loss/draw), termination reason, rating changes, and a rematch button.

### `GameNoteEditor`

Per-game note editor with auto-save. Allows players to write and persist notes for any game, with debounced auto-save to the server.

### `ExportPGN`

PGN export button. Provides copy-to-clipboard and file download options for the game in standard PGN format.

### `MoveFeedbackPopup`

Move classification popup during bot games. Displays a brief animated popup showing the classification (brilliant, great, good, inaccuracy, mistake, blunder) after each move.

### `ActivityFeed`

Recent activity feed component. Displays a chronological list of recent user actions (games played, friends added, achievements).

### `CollectionPicker`

Collection selection dropdown. Lets users pick from existing game collections or create a new one when saving a game.

### `TosGate`

Terms of Service acceptance gate. Blocks the app UI until the authenticated user accepts the Terms of Service. Renders children directly if not logged in or already accepted. Shows an inline summary of the Terms and Privacy Policy with Accept/Decline buttons. Declining deactivates the account via `POST /api/auth/decline-tos`; accepting calls `POST /api/auth/accept-tos` and updates the auth store.

## Stats Components

### `RatingChart`

Line chart showing rating history over time. Supports filtering by time control category.

### `RecordBar`

Horizontal stacked bar showing win/loss/draw record with counts and percentages.

### `OpeningsTable`

Sortable table of most-played openings with win rate and average accuracy per opening.

### `AccuracyCard`

Card displaying overall and per-time-control average move accuracy percentages.

### `StreakBadge`

Badge showing current and best win/loss streaks.

### `ActivityChart`

Heatmap or bar chart of games played per day/week, similar to a contribution graph.

## UI Components

### `ChallengePopup`

Modal for incoming game challenges. Listens to `challenge:incoming` socket event.

### `AdminLayout` (moved to `apps/admin`)

The admin layout is now part of the separate `apps/admin` app. See [Admin Panel docs](../admin/overview.md).

### `ThemeProvider`

Applies dark/light mode class to `<html>` element based on settings store.

### `BoardThemeStyles`

Injects global CSS overrides for board colors and piece set filters based on settings store.

### `Skeleton` / `BoardSkeleton` / `MoveListSkeleton` / `ProfileSkeleton`

Loading placeholder components with pulse animation.

### `ErrorBoundary`

React class component error boundary. Shows friendly error message with refresh button.

### `Toast`

Fixed-position toast notification. Zustand-backed — call `useToast().show(message, type)` from anywhere.

### `ConfirmModal`

Reusable confirmation dialog with configurable title, message, button label, and danger/primary styling. Supports a loading state that disables both buttons and replaces the confirm label with an ellipsis. Returns null when not open.

**Props:** `open: boolean`, `title: string`, `message: string`, `confirmLabel?: string`, `confirmVariant?: 'danger' | 'primary'`, `onConfirm: () => void`, `onCancel: () => void`, `loading?: boolean`

### `KeyboardShortcutsHelp`

Modal overlay listing available keyboard shortcuts as key/description pairs in a two-column layout. Closes when clicking the backdrop or the Esc button. Accepts an array of `{ key, description }` objects.

**Props:** `open: boolean`, `onClose: () => void`, `shortcuts: { key: string, description: string }[]`
