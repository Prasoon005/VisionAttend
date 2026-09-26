# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── Build: install workspace deps, compile shared + api ──
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
# The schema is needed by the `prisma generate` postinstall step.
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @visionattend/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @visionattend/shared build \
 && pnpm --filter @visionattend/api build \
 && pnpm --filter @visionattend/api deploy --legacy --prod /out

# ── Runtime: production deps + compiled output only, non-root ──
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1
# Apply pending migrations, then start. Fine for a single instance; with
# several replicas, run migrations as a separate one-off job instead.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
