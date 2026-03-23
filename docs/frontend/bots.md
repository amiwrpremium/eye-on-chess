# Bot Personalities

EyeOnChess features 31 distinct bot personalities ranging from 200 to 3200 Elo, each with unique playstyles and behaviors.

## Architecture

Bot personalities are **YAML-configured and database-driven**:

```
deployment/config/bots.yml     ← Source of truth (edit this)
        ↓
   make seed-bots              ← Seeds DB (only creates, never overwrites)
        ↓
   BotProfile table            ← Admin-editable via admin panel
        ↓
   GET /api/bots               ← Served to frontend (nginx-cached 1 hour)
        ↓
   localStorage                ← Cached on device for offline use
```

- **YAML** defines the default bot roster
- **Seeder** runs on every container restart, only creates bots that don't exist
- **Admin edits** in the DB are never overwritten by the seeder
- **Frontend** fetches from API, caches to localStorage, works offline from cache

## Tiers

Bots are organized into three tiers based on how their moves are generated:

| Tier       | Elo Range | Engine               | Description                                                                     |
| ---------- | --------- | -------------------- | ------------------------------------------------------------------------------- |
| **Custom** | 200-1200  | JS minimax           | Pure JavaScript with personality quirks — random moves, blunders, capture greed |
| **Hybrid** | 1300-1900 | Stockfish + blunders | Stockfish at limited depth with chance to play random moves                     |
| **Engine** | 2000-3200 | Stockfish UCI_Elo    | Full Stockfish with Elo-limited strength                                        |

## Categories

Bots are grouped into skill categories in the UI:

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

Each bot has tunable parameters that control its playstyle:

| Parameter          | Range   | Effect                                                   |
| ------------------ | ------- | -------------------------------------------------------- |
| `randomMoveChance` | 0-0.5   | Chance to play a completely random legal move            |
| `blunderChance`    | 0-0.3   | Chance to deliberately miss the best move                |
| `captureGreed`     | 0-1     | Bias toward capturing pieces even when it's a bad trade  |
| `aggressionBias`   | -1 to 1 | Preference for attacking (+) vs defensive (-) moves      |
| `maxDepth`         | 1-18    | How many moves ahead the bot can "see"                   |
| `queenEarly`       | bool    | Brings queen out in the first 5 moves                    |
| `pawnPusher`       | bool    | Pushes random edge pawns                                 |
| `sortOrder`        | int     | Controls display order in API responses (lower = first)  |
| `enabled`          | bool    | Admins can disable a bot without deleting it from the DB |

## Bot Selection UI

Players select a bot from a visual grid on the `/play/bot` page, grouped by category (Beginner, Novice, etc.) with sticky headers. Each card shows the bot's emoji avatar, name, Elo badge (color-coded), and a short description.

A "Custom Elo" toggle allows advanced users to use the raw Elo slider with Stockfish directly.

## API

`GET /api/bots` returns enabled bot personalities from the database (no authentication required). Response is cached by nginx for 1 hour.

## Seeding

```bash
make seed-bots    # Reads bots.yml, creates only missing bots in DB
```

The seeder also runs automatically on every API container restart. It only creates bots that don't already exist in the database — it never overwrites existing rows. This means admin edits (name, description, Elo, behavior parameters, enabled/disabled state) are fully preserved across restarts and redeployments.

## Adding a New Bot

Add an entry to `deployment/config/bots.yml`:

```yaml
- id: unique-slug
  name: Display Name
  elo: 1500
  description: "Short personality description"
  avatar: "\U0001F600"
  tier: hybrid
  category: advanced
  randomMoveChance: 0.03
  blunderChance: 0.08
  captureGreed: 0.4
  aggressionBias: 0.4
  maxDepth: 5
  queenEarly: false
  pawnPusher: false
```

Then run `make seed-bots` to add it to the database.

## Admin Management

Admins can customize bot personalities through the database:

- Edit name, description, avatar, and Elo
- Tune behavior parameters
- Enable/disable individual bots
- Changes are preserved across container restarts (seeder won't overwrite)
