# Theming

EyeOnChess supports dark/light mode, 6 board themes, and 3 piece sets. All preferences are saved to the user's profile in the database.

## Dark / Light Mode

Controlled by adding `dark` or `light` class to the `<html>` element.

- **Dark mode** (default): standard Tailwind dark classes (`bg-gray-950`, `text-white`, etc.)
- **Light mode**: CSS overrides in `globals.css` that remap dark grays to light equivalents

The `ThemeProvider` component watches the `darkMode` value from `useSettingsStore` and toggles the class.

## Board Themes

6 color themes applied via CSS overrides on Chessground elements.

| Theme   | Light squares | Dark squares |
| ------- | ------------- | ------------ |
| Classic | `#f0d9b5`     | `#b58863`    |
| Wood    | `#e8c98e`     | `#a67c52`    |
| Green   | `#ffffdd`     | `#86a666`    |
| Blue    | `#dee3e6`     | `#8ca2ad`    |
| Purple  | `#e8d0ff`     | `#9070b0`    |
| Dark    | `#4b4847`     | `#302e2b`    |

Applied by the `BoardThemeStyles` component which injects global `<style>` targeting `cg-board square.white` and `cg-board square.black`.

## Piece Sets

3 piece style variants using CSS filters on Chessground piece images.

| Set     | CSS Filter                     | Effect                              |
| ------- | ------------------------------ | ----------------------------------- |
| Classic | `none`                         | Default Chessground cburnett pieces |
| Modern  | `saturate(1.2) contrast(1.1)`  | More vivid colors                   |
| Minimal | `grayscale(0.3) contrast(1.3)` | Muted, high-contrast                |

## Persistence

1. User changes a setting on the `/settings` page
2. `useSettingsStore` updates local state (immediate UI change)
3. `PUT /api/auth/preferences` saves to the `User` record in PostgreSQL
4. On next login/page load, `fetchMe()` loads preferences from the server
5. `syncSettings()` in the auth store updates the settings store

This means preferences follow the user across devices and browser sessions.

## Adding a New Board Theme

1. Add the color values to `BOARD_COLORS` in `BoardThemeStyles.tsx`
2. Add the key to `VALID_BOARD_THEMES` in `apps/api/src/routes/auth.ts`
3. Add a preview button in `apps/web/src/app/settings/page.tsx`
