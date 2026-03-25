# Bot Personalities

EyeOnChess features 31 distinct bot personalities ranging from 200 to 3200 Elo, each with unique playstyles, chat messages, reactions, opening preferences, and simulated think times.

## Architecture

Bot personalities are **database-driven with YAML as the seed source**:

```
deployment/config/bots.yml     <- Seed template (initial data only)
        |
   make seed-bots              <- Creates missing bots, never overwrites existing
        |
   BotProfile table            <- Source of truth, editable via admin panel
        |
   GET /api/v1/bots            <- Served to frontend
        |
   localStorage                <- Cached on device for offline use
```

- **YAML** defines the default bot roster for new environments
- **Seeder** only creates bots that don't exist (non-destructive)
- **Admin panel** (`/admin/bots`) is the primary editing interface
- **`FORCE_RESEED=1 make seed-bots`** overwrites all bots from YAML (destructive)
- **Frontend** fetches from API, caches to localStorage, works offline from cache

## Tiers

| Tier       | Elo Range | Engine               | Description                                                                     |
| ---------- | --------- | -------------------- | ------------------------------------------------------------------------------- |
| **Custom** | 200-1200  | JS minimax           | Pure JavaScript with personality quirks — random moves, blunders, capture greed |
| **Hybrid** | 1300-1900 | Stockfish + blunders | Stockfish at limited depth with chance to play random moves                     |
| **Engine** | 2000-3200 | Stockfish UCI_Elo    | Full Stockfish with Elo-limited strength                                        |

## Categories

| Category         | Elo Range | Bots                                             |
| ---------------- | --------- | ------------------------------------------------ |
| **Beginner**     | 200-400   | Amir, Timmy, Bella                               |
| **Novice**       | 500-800   | Rusty, Chloe, Omar, Noodle                       |
| **Intermediate** | 900-1200  | Elena, Scout, Ahmed, Maple                       |
| **Advanced**     | 1300-1600 | Viktor, Sophie, Jin, Diana                       |
| **Expert**       | 1700-2000 | Rook, Nina, Felix, Hana                          |
| **Master**       | 2100-2500 | Kaspar, Yuki, Boris, Aria, Sven                  |
| **Grandmaster**  | 2600-3200 | Mei, Atlas, Titan, Oracle, Quantum, Nexus, Erfan |

## Behavior Parameters

| Parameter          | Range   | Effect                                                  |
| ------------------ | ------- | ------------------------------------------------------- |
| `randomMoveChance` | 0-0.5   | Chance to play a completely random legal move           |
| `blunderChance`    | 0-0.3   | Chance to deliberately miss the best move               |
| `captureGreed`     | 0-1     | Bias toward capturing pieces even when it's a bad trade |
| `aggressionBias`   | -1 to 1 | Preference for attacking (+) vs defensive (-) moves     |
| `maxDepth`         | 1-18    | How many moves ahead the bot can "see"                  |
| `queenEarly`       | bool    | Brings queen out in the first 5 moves                   |
| `pawnPusher`       | bool    | Pushes random edge pawns                                |

## Bot Chat Messages

Bots send contextual chat messages during games based on their personality. Messages appear as blue speech bubbles next to the bot's avatar.

**Events that trigger messages:**
gameStart, onCapture, onBeingChecked, onGivingCheck, onBlunder, onPlayerBlunder, onWinning, onLosing, onCheckmate, onCheckmated, onDraw

**Behavior:**

- Messages are randomly selected from the event's pool
- 60% probability gate (gameStart/checkmate always show)
- Rate limited: max 1 message per 5 seconds
- Auto-dismiss after 3 seconds
- Stored as `messages` JSON field on BotProfile

**Personality examples:**

- Amir (200): "Hi! I just learned how the horsey moves!", "Was that yours?"
- Erfan (3200): "Show me your best.", "Inevitable."

## Simulated Think Time

Bots pause before moving to simulate human-like thinking. The delay is derived from existing personality parameters — no additional config needed.

**Formula:**

- Custom tier: base 800 + confusionFactor × 1800 (±variance)
- Hybrid tier: base 600 + confusionFactor × 800
- Engine tier: base 300 + (3200-elo)/1200 × 400

**Context modifiers:** in check +50%, losing +30%, winning -30%, player blundered -40%, capture -20%, opening -30%, endgame +20%

**Result:** Amir ~1.5-3s (confused), Erfan ~300ms (machine-like). Clamped [200, 4000]ms.

## Bot Reactions

Bots send floating emoji reactions during games based on their personality:

| Event            | Reaction     | Probability                     |
| ---------------- | ------------ | ------------------------------- |
| Bot captures     | ✨ brilliant | captureGreed × 0.5              |
| Bot gives check  | ✨ brilliant | aggressionBias × 0.4            |
| Bot in check     | 🤔 thinking  | confusionFactor × 0.6           |
| Player good move | 👍 good_move | 15%                             |
| Player blunder   | 🤦 blunder   | 30% (beginners) / 10% (masters) |
| During thinking  | 🤔 thinking  | confusionFactor × 0.3           |
| Game ends        | 🤝 gg        | 80%                             |

Rate limited: 1 per 8 seconds, max 5 on screen. Reuses the existing `ReactionOverlay` component.

## Opening Preferences

Custom-tier bots (200-1200) follow preferred opening move sequences before falling back to minimax.

**Format:** SAN move sequences split by color:

```json
{
  "asWhite": ["e4 e5 Nf3 Nc6 Bc4", "e4 e5 f4"],
  "asBlack": ["e5", "c5"]
}
```

**Behavior:**

- Bot picks a random opening from its pool at game start
- Follows the sequence move-by-move
- Falls back to minimax if opponent deviates or sequence exhausts
- Personality quirks (randomMoveChance, blunderChance) can still override

**Examples:**

- Bella (400): Attempts Scholar's Mate (Qh5) or Italian Game (Bc4)
- Ahmed (1100): Plays Ruy Lopez (Bb5 a6 Ba4) or Queen's Gambit (d4 d5 c4)
- Amir (200): No openings — too chaotic to follow a book

## Game State Persistence

Bot games auto-save state to prevent data loss from accidental tab closure or navigation:

- **Auto-save:** Game state saved to localStorage every move under `eyeonchess-game-{id}`
- **Backup save:** `beforeunload` handler fires on tab close as a fallback
- **Resume:** On page load, the game page checks for a saved in-progress game and resumes automatically
- **Cleanup:** Saved state cleared on game completion

**Sync after completion:**

- Completed offline games are synced via `POST /api/v1/games/sync` (game creation) or `POST /api/v1/games/:id/sync-moves` (move batch sync to existing game)
- If sync fails, the game is added to a pending queue (`eyeonchess-pending-syncs` in localStorage) and retried on next page load via `retryPendingSyncs()`
- Error toast shown to user: "Game sync failed — will retry later"
- `syncOfflineGames` returns `{ synced, failed }` counts for reporting

**Key functions** in `src/lib/offlineSync.ts`:

- `saveInProgress(id, state)` — save current game state
- `loadInProgress(id)` — restore saved game
- `clearInProgress(id)` — remove saved state after completion

## Admin Management

The admin panel (`/admin/bots`) provides full CRUD:

- **Edit** any bot: name, Elo, description, behavior sliders, messages (JSON), openings (JSON)
- **Enable/Disable** bots without deleting
- **Create** new bots with all parameters
- **Delete** bots permanently
- **Reseed from YAML** to reset all bots to default values (destructive)

All changes are audited and persist across container restarts.

## API

`GET /api/v1/bots` returns enabled bot personalities (no auth required). Response includes all fields: behavior params, messages, preferredOpenings.

## Seeding

```bash
make seed-bots                    # Creates missing bots only (safe)
FORCE_RESEED=1 make seed-bots    # Overwrites all bots from YAML (destructive)
```

The seeder runs on every API container restart. It only creates bots that don't exist — admin edits are preserved.
