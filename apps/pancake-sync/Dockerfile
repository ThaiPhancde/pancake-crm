FROM oven/bun:1.3.12-slim AS build
WORKDIR /repo
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/crm" \
	bun install --frozen-lockfile --filter pancake-sync
RUN DATABASE_URL="postgresql://build:build@localhost:5432/crm" \
	bun run --cwd packages/db db:generate

FROM oven/bun:1.3.12-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /repo /repo
USER bun
STOPSIGNAL SIGTERM
CMD ["bun", "apps/pancake-sync/src/main.ts"]
