# Admin Panel Overview

The admin panel is accessible at `/admin` for users with the `ADMIN` role.

## Access

1. Log in with an admin account (the seed user is created as admin on first boot)
2. On the Play page, click the purple **"Admin Panel"** button
3. The button is only visible to users with `role: ADMIN`

## Features

### Dashboard (`/admin`)

- Total users and active users count
- Total games, active games, completed games, games today
- Analysis queue depth
- Current site settings summary

### User Management (`/admin/users`)

- Searchable, paginated user table
- **Activate/Deactivate** — prevents login for deactivated users
- **Verify/Unverify** — controls email verification status
- **Promote/Demote** — toggle between USER and ADMIN roles
- **Delete** — permanently removes user and all their data
- All destructive actions require confirmation

### Game Management (`/admin/games`)

- Searchable by player name
- Filterable by status (Waiting, Active, Completed, Aborted)
- Paginated table
- Delete games (cascades to moves and analysis)

### Site Settings (`/admin/settings`)

- **Site Name** — white-label display name
- **Open Registration** — toggle new user registrations
- **Max Users** — set a user limit (0 = unlimited)
- **Require Email Verification** — block unverified users from login

Settings are persisted to the database and survive container restarts. Environment variables serve as initial defaults only.

### Audit Log (`/admin/audit-log`)

- Chronological log of all admin actions
- Filterable by action type (user update, user delete, game delete, settings change)
- Shows admin username, action, target, details, IP address, timestamp

## Responsive Design

- Desktop: sidebar navigation with content area
- Mobile: hamburger menu that opens a drawer overlay
- Tables switch to card layouts on small screens
