# Testing

EyeOnChess uses [Vitest](https://vitest.dev/) as its test framework across all packages and apps. The test suite contains 670+ tests across the monorepo.

## Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run only API tests
pnpm --filter api test

# Run only web (frontend) tests
pnpm --filter web test

# Run only chess package tests
pnpm --filter @eyeonchess/chess test
```

## Test Structure

Tests are co-located with the source files they cover, using `.test.ts` or `.test.tsx` extensions:

```
apps/web/src/stores/auth.test.ts
apps/web/src/stores/settings.test.ts
apps/web/src/components/ReactionPicker.test.tsx
apps/web/src/lib/gameModes.test.ts
apps/api/src/routes/auth.test.ts
packages/chess/src/index.test.ts
packages/chess/src/reactions/constants.test.ts
```

## Web Tests

- **Environment:** `jsdom`
- **Libraries:** `@testing-library/react` for component rendering and interaction
- Components are tested for rendering, user interaction, and state changes

## API Tests

- **Environment:** `node`
- **Mocking:** `vi.mock` is used to mock Redis and other external dependencies
- Route handlers are tested for correct HTTP responses, validation, and side effects

## Chess Package Tests

- **Environment:** `node`
- Tests cover move validation, game state, reaction constants, and shared utilities
