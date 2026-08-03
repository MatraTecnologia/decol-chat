# syntax=docker/dockerfile:1

# =============================================================================
# Dashboard (Next.js) — Turborepo SaaS Starter
# Estratégia: `turbo prune` gera um subset podado do monorepo só com o dashboard
# e suas deps de workspace, isolando a camada de deps para melhor cache/tamanho.
# =============================================================================

# ── Base ─────────────────────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
WORKDIR /app

# ── Prune ────────────────────────────────────────────
FROM base AS pruner
RUN npm install -g turbo@2.10.5
COPY . .
RUN turbo prune dashboard --docker

# ── Install ──────────────────────────────────────────
# Só os manifests + lockfile podado → a camada de install só invalida quando as
# deps do dashboard (ou de suas deps de workspace) mudam.
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# Build-time public env
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG NEXT_PUBLIC_APP_KEYWORDS
ARG NEXT_PUBLIC_APP_CREATOR
ARG NEXT_PUBLIC_COMPANY_NAME
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_INDEXABLE
ARG NEXT_PUBLIC_API_URL
# Embedded Signup (Coexistence) — identificadores publicos do app Meta.
# O App Secret nunca entra aqui: ele fica so no runtime da API.
ARG NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_ES_CONFIG_ID
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV NEXT_PUBLIC_APP_KEYWORDS=$NEXT_PUBLIC_APP_KEYWORDS
ENV NEXT_PUBLIC_APP_CREATOR=$NEXT_PUBLIC_APP_CREATOR
ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_INDEXABLE=$NEXT_PUBLIC_INDEXABLE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_META_APP_ID=$NEXT_PUBLIC_META_APP_ID
ENV NEXT_PUBLIC_META_ES_CONFIG_ID=$NEXT_PUBLIC_META_ES_CONFIG_ID
ENV NEXT_TELEMETRY_DISABLED=1

# `turbo build` builda @workspace/shared (via `^build`) antes do dashboard.
RUN pnpm turbo build --filter=dashboard

# ── Runner ───────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next standalone output (monorepo): server.js fica em apps/dashboard/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/dashboard/server.js"]
