FROM eyeonchess-base AS base

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/chess/package.json ./packages/chess/

RUN pnpm install --frozen-lockfile && pnpm store prune

COPY packages/chess ./packages/chess
COPY apps/web ./apps/web

EXPOSE 3000

CMD ["pnpm", "--filter", "@eyeonchess/web", "dev"]
