ARG NODE_VERSION=22

# ── Base: install dependencies ───────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

RUN npm install -g bun@latest

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Dev: source + Prisma generate ────────────────────────────
FROM base AS dev

COPY --chown=node:node . .
RUN npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma

USER node

# ── Build: production artifacts ──────────────────────────────
FROM base AS build

COPY . .
RUN npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
RUN npx nx run-many -t build --parallel=3

# ── Production: api-gateway ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS api-gateway

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist/apps/api-gateway ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ── Production: institute-service ────────────────────────────
FROM node:${NODE_VERSION}-alpine AS institute-service

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist/apps/institute-service ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
