# Stats API

Personal statistics dashboard. All endpoints require authentication.

## REST Endpoints

### `GET /api/v1/stats`

Get the authenticated user's stats dashboard data. Cached in Redis for 60 seconds.

**Response (200):**

```json
{
  "rating": {
    "current": 1350,
    "history": [
      { "date": "2026-01-15", "rating": 1200 },
      { "date": "2026-01-16", "rating": 1232 }
    ]
  },
  "record": {
    "wins": 25,
    "losses": 18,
    "draws": 7,
    "vsHuman": { "wins": 15, "losses": 12, "draws": 5 },
    "vsBot": { "wins": 10, "losses": 6, "draws": 2 }
  },
  "openings": [
    { "name": "Sicilian Defense", "eco": "B20", "wins": 8, "losses": 3, "draws": 1, "count": 12 }
  ],
  "accuracy": {
    "average": 72.5,
    "best": { "value": 95.2, "gameId": "clx..." },
    "worst": { "value": 41.8, "gameId": "clx..." },
    "gamesAnalyzed": 30
  },
  "streaks": {
    "current": { "type": "win", "count": 3 },
    "bestWin": 7
  },
  "activity": [
    { "date": "2026-03-20", "count": 4 },
    { "date": "2026-03-21", "count": 2 }
  ],
  "totalGames": 50
}
```

### Response Fields

| Field        | Description                                                           |
| ------------ | --------------------------------------------------------------------- |
| `rating`     | Current rating and historical rating progression (bot games excluded) |
| `record`     | Win/loss/draw totals, split by human and bot opponents                |
| `openings`   | Top 5 openings by frequency, with win/loss/draw breakdown             |
| `accuracy`   | Average, best, and worst accuracy from analyzed games, plus count     |
| `streaks`    | Current streak (win/loss/none) and best-ever win streak               |
| `activity`   | Games per day over the last 30 days                                   |
| `totalGames` | Total completed games                                                 |

### Notes

- Only completed games are included (not aborted).
- Rating history is computed by replaying Elo changes in chronological order; bot games are excluded from rating calculations.
- Opening detection uses the first ~10 moves of each game to look up ECO codes.
- Accuracy data comes from games that have been analyzed via the analysis pipeline.
