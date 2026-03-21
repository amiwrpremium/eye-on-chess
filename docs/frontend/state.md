# State Management

All global state is managed with [Zustand](https://zustand-demo.pmnd.rs/) stores in `apps/web/src/stores/`.

## `useAuthStore` (`stores/auth.ts`)

Authentication state.

| Field       | Type           | Description                         |
| ----------- | -------------- | ----------------------------------- |
| `user`      | `User \| null` | Current user (null when logged out) |
| `isLoading` | `boolean`      | True during initial auth check      |

| Method                                | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `register(email, username, password)` | Register and set tokens                                |
| `login(email, password)`              | Login and set tokens                                   |
| `logout()`                            | Clear tokens and user                                  |
| `refresh()`                           | Refresh access token via cookie                        |
| `fetchMe()`                           | Refresh token + fetch user profile (used on page load) |

**Token handling:**

- Access token stored in module-level variable (not in store, not in localStorage)
- `setAccessToken()` / `getAccessToken()` in `lib/api.ts`
- On `fetchMe()` and `login()`, user preferences are synced to the settings store

## `useSettingsStore` (`stores/settings.ts`)

User preferences (theme, board, pieces).

| Field        | Type         | Default     | Description       |
| ------------ | ------------ | ----------- | ----------------- |
| `darkMode`   | `boolean`    | `true`      | Dark/light mode   |
| `boardTheme` | `BoardTheme` | `"classic"` | Board color theme |
| `pieceSet`   | `PieceSet`   | `"classic"` | Piece style       |

| Method                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `setDarkMode(dark)`    | Update + save to API                     |
| `setBoardTheme(theme)` | Update + save to API                     |
| `setPieceSet(set)`     | Update + save to API                     |
| `loadFromUser(prefs)`  | Load from user profile (called on login) |

Changes are:

1. Applied immediately to the UI (optimistic)
2. Saved to the server via `PUT /api/auth/preferences`
3. Persisted to the User record in PostgreSQL

## `useToast` (`components/Toast.tsx`)

Toast notification state.

| Method                 | Description                           |
| ---------------------- | ------------------------------------- |
| `show(message, type?)` | Show toast (`"success"` or `"error"`) |
| `clear()`              | Dismiss toast                         |

Auto-dismisses after 3 seconds.

## API Client (`lib/api.ts`)

Not a Zustand store, but module-level state:

- `accessToken` — stored in closure, set via `setAccessToken()`
- Axios instance with `withCredentials: true` and `Authorization` header interceptor
- 401 interceptor with refresh queue (prevents thundering herd during concurrent refresh)
