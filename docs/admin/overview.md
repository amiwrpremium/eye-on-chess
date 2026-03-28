# Admin Panel Overview

The admin panel is a separate Next.js app (`apps/admin`) served on `admin.{your-domain}`.

## Access

1. Log in with an admin account on the main site (the seed user is created as admin on first boot)
2. On the Play page, click the purple **"Admin Panel"** button (links to the admin subdomain)
3. The button is only visible to users with `role: ADMIN`
4. The admin app verifies admin role via the shared API — non-admins are redirected to the main site

## Features

### Dashboard (`/`)

Rich overview with 17+ metrics:

- **Key Metrics**: total users, active users, verified %, online now, active games, analysis queue (color-coded health badge)
- **Activity Snapshot**: new users (7d), games today/week/month
- **Game Analytics**: result distribution bars (white/black/draw), time control popularity bars, bot vs human game split
- **Quick Info**: top 3 most played bots, recent admin actions (last 5), site status badges
- **Site Status**: registration open/closed, max users, email verification on/off

### User Management (`/users`)

- Searchable, paginated user table
- **Activate/Deactivate** — prevents login for deactivated users
- **Verify/Unverify** — controls email verification status
- **Promote/Demote** — toggle between USER and ADMIN roles
- **Create** — create new users with generated passwords
- **Delete** — permanently removes user and all their data
- All destructive actions require confirmation

### Game Management (`/games`)

- Searchable by player name
- Filterable by status (Waiting, Active, Completed, Aborted)
- Paginated table
- Delete games (cascades to moves and analysis)

### Bot Management (`/bots`)

Full CRUD for bot personalities:

- **Table view**: avatar, name, Elo, tier, category, enabled status
- **Search** by name, ID, or category
- **Edit modal**: all personality parameters via sliders (randomMoveChance, blunderChance, captureGreed, aggressionBias, maxDepth), toggles (queenEarly, pawnPusher, enabled), JSON editors for messages and opening preferences
- **Create** new bots with all parameters
- **Enable/Disable** without deleting
- **Delete** permanently
- **Reseed from YAML** — one-click reset of all bots to `bots.yml` defaults (destructive, with confirmation)

Bot edits persist across container restarts — the seeder only creates missing bots, never overwrites existing ones.

### Site Settings (`/settings`)

- **Site Name** — white-label display name
- **Open Registration** — toggle new user registrations
- **Max Users** — set a user limit (0 = unlimited)
- **Require Email Verification** — block unverified users from login

Settings are persisted to the database and survive container restarts. Environment variables serve as initial defaults only.

### Audit Log (`/audit-log`)

- Chronological log of all admin actions
- Filterable by action type (user.update, user.delete, game.delete, settings.update, bot.create, bot.update, bot.delete, bot.reseed)
- Shows admin username, action, target, details, IP address, timestamp

## Security

- All routes require `ADMIN` role (checked against DB on every request)
- CSRF double-submit cookie pattern on all mutations
- Rate limited: 60 requests/min per IP
- Cannot demote/deactivate/delete yourself
- Cannot remove the last admin
- All mutations logged to audit trail

## Responsive Design

- Desktop: sidebar navigation with content area
- Mobile: hamburger menu that opens a drawer overlay
- Tables switch to card layouts on small screens
