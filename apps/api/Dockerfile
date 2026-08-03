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
#
# Env vars do serviço (não declaradas aqui de propósito: `ENV VAR=` viraria
# string vazia, que reprova no `.min(1)` do schema e impede o boot — pior que
# ausente). Além das de base (DATABASE_URL, BETTER_AUTH_SECRET, REDIS_URL, …),
# a integração WhatsApp exige:
#
#   WHATSAPP_ENCRYPTION_KEY    cifra o access token gravado na conta
#   META_APP_ID                troca do authorization code do Embedded Signup
#   META_APP_SECRET            troca do code + HMAC do webhook
#   META_ES_CONFIG_ID          configuração de coexistence do App Dashboard
#   META_WEBHOOK_VERIFY_TOKEN  handshake GET /webhooks/whatsapp
#   PUBLIC_WEBHOOK_BASE_URL    URL pública da API (base do webhook)
#
# Sem META_APP_SECRET o webhook responde 401 em todo evento, e 401 repetido faz
# a Meta desativar a assinatura — a ingestão morre sem erro visível no boot.
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=builder /app/ .

WORKDIR /app/apps/api

EXPOSE 80

CMD ["sh", "-c", "pnpm db:generate && pnpm db:push && pnpm start"]
