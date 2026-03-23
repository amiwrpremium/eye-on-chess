# Keyboard Shortcuts

Keyboard shortcuts are implemented via the `useKeyboardShortcuts` hook (`apps/web/src/lib/useKeyboardShortcuts.ts`). The hook registers global `keydown` listeners and ignores events from `input`, `textarea`, and `select` elements, as well as events with `Ctrl`, `Alt`, or `Meta` modifiers.

Each page displays its shortcuts in a help dialog toggled with `?`.

## Bot Game Page (`/play/bot`)

| Key      | Action                                    |
| -------- | ----------------------------------------- |
| `Left`   | Previous move                             |
| `Right`  | Next move                                 |
| `Home`   | Go to first move                          |
| `End`    | Go to last move                           |
| `F`      | Flip board                                |
| `H`      | Toggle hint (when hints are enabled)      |
| `R`      | Resign (opens confirmation modal)         |
| `Escape` | Close modal (resign, start confirm, help) |
| `?`      | Toggle shortcuts help dialog              |

## Live Game Page (`/game/:id`)

| Key      | Action                            |
| -------- | --------------------------------- |
| `Left`   | Previous move                     |
| `Right`  | Next move                         |
| `Home`   | Go to first move                  |
| `End`    | Go to last move                   |
| `F`      | Flip board                        |
| `R`      | Resign (opens confirmation modal) |
| `Escape` | Close modals (resign, draw, help) |
| `?`      | Toggle shortcuts help dialog      |

## Analysis Page (`/game/:id/analysis`)

| Key      | Action                       |
| -------- | ---------------------------- |
| `Left`   | Previous move                |
| `Right`  | Next move                    |
| `Home`   | Go to first move             |
| `End`    | Go to last move              |
| `Escape` | Close shortcuts help dialog  |
| `?`      | Toggle shortcuts help dialog |
