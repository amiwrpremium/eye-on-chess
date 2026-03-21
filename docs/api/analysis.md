# Analysis API

Post-game analysis powered by Stockfish.

## Endpoints (Auth Required)

### `POST /api/games/:id/analyze`

Queue a game for analysis. Must be a player in the game. Game must be completed.

**Response (200):**

```json
{ "status": "queued", "message": "Analysis queued" }
```

If already queued/processing: returns current status without re-queuing.

### `GET /api/games/:id/analysis`

Get analysis results.

**Response (processing):**

```json
{ "status": "processing", "analysis": null }
```

**Response (done):**

```json
{
  "status": "done",
  "analysis": {
    "id": "clx...",
    "whiteAccuracy": 87.3,
    "blackAccuracy": 72.1,
    "opening": { "name": "Sicilian Defense", "eco": "B20" },
    "feedback": [
      {
        "ply": 1,
        "san": "e4",
        "uci": "e2e4",
        "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        "classification": "BEST",
        "bestMove": "e2e4",
        "evalBefore": 0,
        "evalAfter": 25
      }
    ]
  }
}
```

## Analysis Pipeline

1. API pushes `gameId` to Redis `analysis:queue` list
2. Worker polls queue every 2 seconds
3. For each position:
   - Stockfish evaluates at depth 18 (MultiPV 1)
   - For brilliant detection: MultiPV 2 on position before the move
4. Each move classified by centipawn loss
5. Accuracy computed per player
6. Results saved to `GameAnalysis` + `MoveFeedback` tables

## Move Classifications

| Classification | CP Loss                                    | Color       |
| -------------- | ------------------------------------------ | ----------- |
| **Brilliant**  | < 5 + sacrifice + alternatives > 150 worse | Cyan        |
| **Great**      | 0 - 5                                      | Blue        |
| **Best**       | 0 - 10                                     | Green       |
| **Excellent**  | 10 - 25                                    | Light green |
| **Good**       | 25 - 50                                    | Gray        |
| **Inaccuracy** | 50 - 100                                   | Yellow      |
| **Mistake**    | 100 - 200                                  | Orange      |
| **Blunder**    | 200+                                       | Red         |
| **Forced**     | Only 1 legal move                          | Gray        |

### Brilliant Detection

A move is brilliant if:

1. It involves a material sacrifice (attacker value > captured value)
2. Centipawn loss < 5 (it's a good move)
3. The next-best alternative loses > 150 centipawns

### Accuracy Formula

```
accuracy = average(2 / (1 + exp(0.004 * cpLoss)) * 100)
```

Computed separately for white and black moves.

## Opening Recognition

~65 common openings indexed by SAN move sequence. Longest prefix match (most specific opening that matches the game's moves).

## Job Status

Tracked in Redis as `analysis:status:{gameId}`:

- `queued` — waiting in queue
- `processing` — worker is analyzing
- `done` — results saved to DB
- `error` — analysis failed
