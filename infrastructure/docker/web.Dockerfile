# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @visionattend/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @visionattend/shared build && pnpm --filter @visionattend/web build

# ── Runtime: static files served by unprivileged nginx on :8080 ──
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
