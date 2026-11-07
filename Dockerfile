# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# --- dev: el codigo se monta como volumen; node_modules vive en volumenes de Docker ---
FROM base AS dev
ENV NODE_ENV=development
CMD ["bun", "run", "dev"]

# --- deps: instala dependencias con el lockfile ---
FROM base AS deps
COPY package.json bun.lock ./
COPY server/package.json server/
COPY web/package.json web/
RUN bun install --frozen-lockfile

# --- build: compila la SPA ---
FROM deps AS build
COPY . .
RUN bun run --filter web build

# --- prod: un solo contenedor con la API y la SPA estatica ---
FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/server/node_modules server/node_modules
COPY package.json ./
COPY server server
COPY --from=build /app/web/dist web/dist
WORKDIR /app/server
EXPOSE 3000
USER bun
# Aplica migraciones pendientes, ejecuta el seed (idempotente) y arranca el servidor
CMD ["sh", "-c", "bun run migrate && bun run seed && bun run start"]
