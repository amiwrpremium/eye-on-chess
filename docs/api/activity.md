# Activity API

Activity feed showing recent events for the user and their friends. All endpoints require authentication.

## REST Endpoints

### `GET /api/v1/activity`

Get the activity feed. Returns events from the last 24 hours for the authenticated user and their friends. Cached in Redis for 30 seconds.

**Response (200):**

```json
{
  "events": [
    {
      "type": "game_won",
      "message": "alice beat bob (Blitz)",
      "timestamp": "2026-03-22T14:30:00.000Z",
      "link": "/game/clx.../analysis",
      "usernames": ["alice", "bob"]
    },
    {
      "type": "game_analyzed",
      "message": "Game analyzed: alice vs bob",
      "timestamp": "2026-03-22T14:25:00.000Z",
      "link": "/game/clx.../analysis",
      "usernames": ["alice", "bob"]
    },
    {
      "type": "friend_added",
      "message": "You are now friends with charlie",
      "timestamp": "2026-03-22T12:00:00.000Z",
      "link": "/profile/charlie",
      "usernames": ["charlie"]
    }
  ]
}
```

### ActivityEvent Object

| Field       | Type     | Description                                                                   |
| ----------- | -------- | ----------------------------------------------------------------------------- |
| `type`      | string   | One of: `game_won`, `game_lost`, `game_draw`, `game_analyzed`, `friend_added` |
| `message`   | string   | Human-readable description                                                    |
| `timestamp` | string   | ISO 8601 timestamp                                                            |
| `link`      | string   | Link to related page (e.g. game analysis, profile)                            |
| `usernames` | string[] | Usernames involved in the event                                               |

### Data Sources

- **Games** -- Up to 15 most recent completed games involving the user or their friends.
- **Analyses** -- Up to 5 most recent game analyses.
- **Friendships** -- Up to 5 recently accepted friend requests.

Events are merged, sorted by timestamp descending, and limited to 20 total.
