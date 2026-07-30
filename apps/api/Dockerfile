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

# `prisma.config.ts` faz env('DATABASE_URL') e lança se a var não existir, mesmo
# em `generate`, que só lê o schema e não conecta. Precisa valer para todo o
# estágio: `turbo build` dispara `db:generate` de novo via `dependsOn`, num shell
# próprio. Dummy — a URL real vem das env vars do serviço em runtime.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# `turbo build` roda db:generate (dependsOn) e builda @workspace/shared (^build).
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
