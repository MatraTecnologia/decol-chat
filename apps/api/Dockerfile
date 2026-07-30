# syntax=docker/dockerfile:1

# =============================================================================
# API (Fastify + Prisma) — Turborepo SaaS Starter
# Estratégia: `turbo prune` gera um subset podado do monorepo só com a API e suas
# deps de workspace (@workspace/shared), isolando a camada de deps.
# =============================================================================

# ── Base ─────────────────────────────────────────────
FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
WORKDIR /app

# ── Prune ────────────────────────────────────────────
FROM base AS pruner
RUN npm install -g turbo@2.10.5
COPY . .
RUN turbo prune @workspace/api --docker

# ── Install ──────────────────────────────────────────
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# Prisma client (gitignored, precisa ser gerado antes do build). Dummy URL —
# `prisma generate` só lê o schema, não conecta.
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm --filter @workspace/api db:generate
# `turbo build` builda @workspace/shared (via `^build`) antes da API.
RUN pnpm turbo build --filter=@workspace/api

# ── Runtime ──────────────────────────────────────────
# O CMD roda db:generate/db:push/start no boot, então o runtime precisa das
# devDeps (prisma CLI, tsx) — reaproveitamos a árvore do builder inteira.
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=builder /app/ .

WORKDIR /app/apps/api

EXPOSE 80

CMD ["sh", "-c", "pnpm db:generate && pnpm db:push && pnpm start"]
