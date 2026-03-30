FROM node:22-alpine AS base
RUN apk add --no-cache wget && npm install -g pnpm@10.32.1

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/ui/package.json ./packages/ui/
COPY tooling/eslint-config/package.json ./tooling/eslint-config/
COPY tooling/prettier-config/package.json ./tooling/prettier-config/
COPY tooling/typescript-config/package.json ./tooling/typescript-config/
RUN pnpm install --frozen-lockfile && pnpm store prune

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://localhost
ARG NEXT_PUBLIC_SITE_URL=http://localhost
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/packages/api-client/node_modules* ./packages/api-client/node_modules/
COPY --from=deps /app/packages/ui/node_modules* ./packages/ui/node_modules/
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY tooling ./tooling
COPY packages/api-client ./packages/api-client
COPY packages/ui ./packages/ui
COPY apps/admin ./apps/admin
RUN pnpm --filter @eyeonchess/admin build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

EXPOSE 3002
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/admin/server.js"]
