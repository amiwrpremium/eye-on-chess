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

## UI Components

### `ChallengePopup`

Modal for incoming game challenges. Listens to `challenge:incoming` socket event.

### `AdminLayout`

Sidebar navigation layout for admin pages. Responsive — collapses to hamburger drawer on mobile.

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

Reusable confirmation dialog with danger/primary variants. Used for all destructive admin actions.
