# Site Settings

Configure platform behavior from `/admin/settings` or via the API.

## Settings

### Site Name

Display name shown to users. Supports white-labeling — change this to brand the platform as your own.

- Max 100 characters
- HTML stripped from input
- Affects the public `GET /api/settings` response

### Open Registration

Toggle whether new users can create accounts.

- When **off**: `POST /api/auth/register` returns `403: Registration is currently closed`
- Existing users can still log in

### Max Users

Maximum number of user accounts allowed.

- `0` = unlimited
- When the limit is reached: new registrations return `403: Maximum user limit reached`
- Existing users are not affected

### Require Email Verification

When enabled, users must have `verified: true` to log in.

- Unverified users get `403: Email not verified` on login
- **No email sending is implemented** — admins must manually verify users via the admin panel
- The seed admin user is created as `verified: true`

## Persistence

Settings are stored in the `SiteSettings` table (singleton row) in PostgreSQL.

**Flow:**

1. On first boot, the seed script creates default settings from environment variables
2. Admin changes settings via the UI or API
3. Changes are saved to the database
4. The registration and login endpoints read from the database
5. If no database record exists, environment variables are used as fallback

This means:

- Settings **survive container restarts** (stored in DB, not env vars)
- Env vars are only used as **initial defaults**
- No restart required to change settings

## API Reference

| Endpoint                  | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `GET /api/admin/settings` | Read current settings                                       |
| `PUT /api/admin/settings` | Update settings (CSRF required)                             |
| `GET /api/settings`       | Public endpoint returning site name and registration status |
