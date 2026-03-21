# User Management

Manage users from `/admin/users` or via the API.

## User Table

The user table displays:

- Username, email, rating
- Role badge (USER / ADMIN)
- Status badge (Active / Inactive)
- Verification status
- Join date

### Search

Type in the search box to filter by username or email (case-insensitive partial match).

### Pagination

20 users per page. Navigate with Prev/Next buttons.

## Actions

### Activate / Deactivate

Toggles the `active` boolean. Deactivated users:

- Cannot log in (receive "Account is deactivated" error)
- Existing sessions are not immediately revoked (tokens expire naturally)
- Their profile and games remain visible

### Verify / Unverify

Toggles the `verified` boolean. Only matters if `requireEmailVerification` is enabled in site settings. Unverified users cannot log in when the setting is active.

### Promote / Demote

Changes role between `USER` and `ADMIN`.

**Protections:**

- Cannot demote yourself
- Cannot demote the last remaining admin

### Delete

Permanently deletes the user and cascades to:

- All their games (where they are white or black)
- All their moves
- All their game analysis
- All their friendships
- All their refresh tokens
- All their audit logs (as admin)

**Protections:**

- Cannot delete yourself
- Cannot delete the last remaining admin
- Requires confirmation dialog

## API Reference

See [Admin API](../api/admin.md) for endpoint details.
