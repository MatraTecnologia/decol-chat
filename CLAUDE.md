# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

- **Always use `const` arrow functions** instead of `function` declarations whenever possible. This applies to components, helpers, utilities, and all other functions.

```typescript
// Correct
const MyComponent = () => { ... }
const formatDate = (date: Date) => { ... }

// Incorrect
function MyComponent() { ... }
function formatDate(date: Date) { ... }
```

## Project Overview

turborepo-saas-starter — full-stack SaaS starter template built with Turborepo, Next.js 16, Fastify REST API with Prisma (PostgreSQL), Better Auth authentication, and BullMQ background jobs. Uses pnpm as the package manager.

## Commands

```bash
# Development - runs all apps and API in parallel
pnpm dev

# Run only the dashboard app
pnpm dev:dashboard

# Run only the API server
pnpm dev:api

# Build all apps and packages
pnpm build

# Lint all workspaces
pnpm lint

# Type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Database management
pnpm db:generate      # Generate Prisma client + Zod schemas (runs fix-zod-imports script)
pnpm db:push          # Sync schema to database
pnpm db:reset         # Force-reset schema + regenerate (DROPS ALL DATA)
pnpm db:studio        # Open Prisma Studio GUI

# Redis
pnpm redis:flush      # FLUSHALL on REDIS_URL (clears cache + queues)

# API client generation
pnpm generate:api     # Regenerate OpenAPI client from API spec

# Clean all build artifacts and node_modules
pnpm clean

# Turborepo boundaries check (undeclared deps + architecture rules)
pnpm boundaries
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm install --frozen-lockfile` then `lint → typecheck → build → boundaries` on every push and PR to `master` (no secrets/services — `SKIP_ENV_VALIDATION` + dummy `DATABASE_URL`/`NEXT_PUBLIC_*` URLs are inlined). To make it a merge gate (branch protection), see [`docs/branch-protection.md`](docs/branch-protection.md).

**Dependency updates:** self-hosted Renovate (`.github/workflows/renovate.yml` + `renovate.json`) opens grouped weekly PRs that run through CI. Setup + config reference: [`docs/renovate.md`](docs/renovate.md).

## API Client Regeneration Workflow

**Whenever you create a route, change a response schema, change how a route receives data (params, body, querystring), or any other API change that affects the frontend, you MUST regenerate the API client.**

Before running `pnpm generate:api`, the API server must be running. Follow this workflow:

1. **Check if the API is up:**
   ```bash
   curl -s http://localhost:3333/health
   ```
2. **If it's not running, start it and wait:**
   ```bash
   pnpm dev:api
   # Wait until the API is ready, then confirm:
   curl -s http://localhost:3333/health
   ```
3. **Once `/health` returns `ok`, regenerate the client:**
   ```bash
   pnpm generate:api
   ```

> Never run `pnpm generate:api` without confirming `/health` responds first — the generator fetches the OpenAPI spec from the live API at `http://localhost:3333`.

## Architecture

### Workspace Structure

```
apps/
  api/          # Fastify REST API (port 3333) - auth, routes, socket.io, queues
  dashboard/    # Main Next.js app (port 3001) - includes admin panel
packages/
  shared/       # Browser-safe shared constants (roles, permissions, auth cookie names)
  api-client/   # Generated OpenAPI client (@hey-api/openapi-ts)
  ui/           # Shared UI components (shadcn/ui based)
  eslint-config/
  typescript-config/
```

### App Route Structure

The dashboard app uses Next.js App Router with route groups. **Dev server runs on port `3001`** (not 3000).

```
apps/dashboard/app/
├── (root)/             # Public pages (landing page)
├── (auth)/             # Auth pages (sign-in, sign-up, forgot-password, reset-password, 2FA)
├── (protected)/        # Authenticated pages
│   ├── (general)/      # Dashboard (welcome page)
│   └── admin/          # Global admin panel (wrapped in <AdminGate>)
│       ├── (root)/         # Redirects to /admin/users
│       └── users/          # User management table
├── api/
│   ├── socket-token/   # Extracts HttpOnly session cookie for Socket.io auth
│   └── clear-session/  # Clears auth cookies and redirects to /sign-in
├── not-authorized/     # Shown to users with role='user'
├── loading.tsx         # Global loading state (FullScreenLoader)
├── error.tsx           # Global error boundary
├── not-found.tsx       # Global 404 page
└── layout.tsx          # Root layout (ThemeProvider + TopLoader + Toaster)
```

### Key Patterns

**Importing from workspace packages:**
```typescript
// UI components
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'

// API client (generated from OpenAPI)
import { listUsers, listMembers } from '@workspace/api-client/sdk'
import { listUsersOptions } from '@workspace/api-client/react-query'

// Roles and shared constants
import { ROLES, ROLE_LABELS } from '@workspace/shared/roles'
```

**Path aliases in apps:**
- `@/*` - app root (e.g., `@/config/env`, `@/providers`)
- `@workspace/ui/*` - UI package
- `@workspace/shared/*` - Shared constants (roles, permissions, auth-cookie)
- `@workspace/api-client/*` - Generated API client

**Environment configuration:**
- Web app uses typed `env.ts` files (`apps/dashboard/config/env.ts`) with `@t3-oss/env-nextjs` for validated env access
- API uses `src/env.ts` with `@t3-oss/env-core` for validated env access
- Copy `.env.example` to `.env` / `.env.local` and configure required variables

### Fastify API Backend

> **IMPORTANT:** When working on the API, follow the conventions at:
> @apps/api/CLAUDE.md

The API is organized as follows:

```
apps/api/src/
├── index.ts              # Entry point (listen)
├── server.ts             # Fastify app builder + plugin registration
├── env.ts                # Typed env validation (@t3-oss/env-core + zod)
├── generated/prisma/     # Prisma client (auto-generated, do not edit)
├── lib/                  # Singletons and helpers
│   ├── prisma.ts         # PrismaClient singleton (PrismaPg adapter)
│   ├── auth.ts           # Better Auth instance + config
│   ├── auth-guard.ts     # requireAuth, requireRole (locale-aware error messages)
│   ├── audit.ts          # recordAudit() — best-effort audit log writer
│   ├── locale.ts         # getLocale(request) + t(locale, key) — locale detection util
│   ├── cache.ts          # Redis cache helper (get, set, del, invalidate)
│   ├── cors.ts           # CORS origins config + isAllowedOrigin()
│   ├── email.ts          # Resend client + sendEmail()
│   ├── storage.ts        # R2 S3Client singleton (two buckets: public/private)
│   ├── ai.ts             # OpenAI model registry (ai-sdk)
│   ├── redis.ts          # Redis client singleton (ioredis, REDIS_URL required)
│   ├── queue.ts          # BullMQ queue/worker factory + registry
│   ├── socket.ts         # Socket.io server setup (dual auth: cookie + token)
│   ├── realtime-events.ts # Realtime event types + constants
│   ├── presence.ts       # In-memory user presence tracker (online/offline)
│   └── get-user-avatar.ts # Gravatar URL helper
├── plugins/              # Fastify plugins (registered in server.ts)
│   ├── auth.ts           # Better Auth catch-all → /api/auth/*
│   ├── locale.ts         # Locale detection → request.locale + request.t()
│   ├── swagger.ts        # @fastify/swagger + Scalar docs → /docs
│   ├── socket.ts         # Socket.io plugin (emitRealtimeEvent decorator)
│   ├── queue.ts          # BullMQ queue initialization + job registration
│   └── bull-board.ts     # Bull Board UI → /admin/queues (HTTP Basic Auth)
├── jobs/                 # BullMQ job definitions
│   ├── example.ts        # Job template with usage patterns
│   └── scheduled/
│       ├── cleanup-sessions.ts    # Daily expired session cleanup (cron)
│       └── cleanup-audit-logs.ts  # Daily audit log cleanup, 90-day retention (cron)
├── routes/               # Autoloaded by @fastify/autoload
│   ├── health.ts         # GET /health, /health/live, /health/ready
│   ├── members/index.ts  # /members (list users)
│   └── users/index.ts    # /users (paginated list)
├── emails/               # react-email templates (i18n-ready: pt-BR + en)
│   ├── translations.ts       # Email string translations (emailT)
│   ├── get-email-locale.ts   # Locale detection from Web API Request
├── generated/zod/        # Zod schemas from Prisma (auto-generated, do not edit)
│   └── schemas.ts        # z.enum() schemas for all Prisma enums
├── shared/               # Shared constants (roles, enums)
│   ├── roles.ts          # ROLES, RoleType, ROLE_LABELS, ROLE_OPTIONS
│   ├── auth-cookie.ts    # Auth cookie prefix + session cookie names
│   ├── permissions.ts    # Better Auth access control (ac, admin, user)
│   ├── i18n.ts           # Better Auth translation dictionaries (en, pt-BR)
│   ├── locale.ts         # App-level translation messages (NOT_FOUND, FORBIDDEN, etc.)
│   └── constants.ts      # Re-exports from roles
├── types/
│   └── fastify.d.ts      # Augments FastifyInstance with io + emitRealtimeEvent; FastifyRequest with locale + t()
└── utils/
    ├── generate-id.ts    # cuid2 ID generator
    └── pagination.ts     # Offset-based pagination helper (paginate, schemas)
```

**Route conventions:**
- Routes live in `src/routes/` and are autoloaded via `@fastify/autoload` with `dirNameRoutePrefix: true`
- Every route must have `schema` with `tags` and `summary` for Swagger docs
- Body/params/querystring must have Zod schema definitions
- Auth guards: `requireAuth(request)`, `requireRole(request, allowedRoles[])`
- Error responses: `reply.notFound(request.t('NOT_FOUND'))`, `reply.forbidden(request.t('FORBIDDEN'))` — use `request.t()` for locale-aware messages
- Locale: `request.locale` (detected from cookie → `Accept-Language` → `pt-BR`) and `request.t(key, fallback?)` available in every route handler
- All imports use `.js` extensions (ESM with `"type": "module"`)

**Database schema** is defined in `apps/api/prisma/schema.prisma` with Prisma ORM. The project uses `prisma-zod-generator` to auto-generate Zod schemas from the Prisma schema — run `pnpm db:generate` to regenerate.

**Prisma models:** User, Session, Account, Verification, TwoFactor, RateLimit (auth infrastructure) + AuditLog (application audit trail).

**API docs** available at `http://localhost:3333/docs` (Scalar UI).

**Queue dashboard** available at `http://localhost:3333/admin/queues` (Bull Board, requires Redis).

### Generated API Client

The `packages/api-client/` package is auto-generated from the API's OpenAPI spec using `@hey-api/openapi-ts`:

```typescript
// SDK functions for direct API calls
import { listUsers, listMembers } from '@workspace/api-client/sdk'

// React Query integration (query keys + options)
import { listUsersOptions, listMembersOptions } from '@workspace/api-client/react-query'

// TypeScript types
import type { ListUsersResponse } from '@workspace/api-client/types'
```

Regenerate after API route changes: `pnpm generate:api`

### Real-time (Socket.io)

The API emits `entity:mutated` Socket.io events after mutations. The frontend listens and invalidates React Query caches automatically.

**Backend flow:**
1. Route handler performs mutation
2. Calls `app.emitRealtimeEvent()`
3. Event broadcast to all connected clients via `io.emit()`

**Frontend flow:**
1. `SocketProvider` manages socket lifecycle
2. Socket connects via token auth (fetched from `/api/socket-token` endpoint)
3. `useRealtimeInvalidation` hook matches `invalidateTags` from the event against query key tags
4. On event, queries whose tags overlap with `invalidateTags` are invalidated and refetched

**Tag-based invalidation:** Both realtime (socket events) and manual invalidation use the same tag-matching mechanism. The backend sends `invalidateTags` (derived from `ENTITY_INVALIDATION_TAGS` in `lib/realtime-events.ts`), and the frontend matches them against `tags` in the hey-api query keys (`[{ _id, tags, ... }]`).

**Manual invalidation in feature components:**
```typescript
import { invalidateByTags } from '@/lib/invalidate-by-tags'

// Invalidate all queries tagged with 'Users'
invalidateByTags(queryClient, ['Users'])
```

**Supported entities:** `user` (maps to `Users` tag).

> **IMPORTANT:** When adding a new entity type, add it to `ENTITY_INVALIDATION_TAGS` in `apps/api/src/lib/realtime-events.ts` with the corresponding Swagger tags. The frontend invalidation (both realtime and manual) uses these tags to match queries.

### Background Jobs (BullMQ)

Background job system powered by BullMQ + Redis. `REDIS_URL` is required.

- **Queue factory:** `createQueue<T>(name)` and `createWorker<T>(name, processor)` in `lib/queue.ts`
- **Job definitions:** `src/jobs/` directory (see `example.ts` for reference pattern)
- **Job registration:** `plugins/queue.ts` initializes queues and workers
- **Scheduled jobs:** `src/jobs/scheduled/` — `cleanup-sessions.ts` (daily expired session cleanup) and `cleanup-audit-logs.ts` (daily, deletes audit logs older than 90 days)
- **Monitoring:** Bull Board UI at `/admin/queues` (protected with HTTP Basic Auth)

### Authentication (Better Auth)

This project uses [Better Auth](https://www.better-auth.com/) with the Prisma adapter.

**Enabled plugins (server):**
- `admin` - Admin role management with custom permissions (global roles, default: `user`)
- `openAPI` - OpenAPI documentation endpoint
- `twoFactor` - Two-factor auth (TOTP + backup codes)
- `emailOTP` - Email-based OTP codes (used by 2FA flow)
- `i18n` (`@better-auth/i18n`) - Localizes auth error messages (en, pt-BR)

**Session & rate-limit storage:** Redis is Better Auth `secondaryStorage` (accelerates session reads + holds rate-limit counters), but PostgreSQL is kept as the source of truth via `storeSessionInDatabase: true` + `verification.storeInDatabase: true` so a Redis flush does not force logouts (verified: a session survives a Redis flush via the DB fallback). See `apps/api/CLAUDE.md` and `docs/better-auth-production-playbook.md`.

**Additional user fields:** `phone: String?` (optional, via `additionalFields`).

**Bootstrap behavior:** The first user ever created in the system is automatically promoted to `admin` (via `databaseHooks.user.create.before` in `lib/auth.ts`). Subsequent signups default to `user`.

**Session freshness:** `session.freshAge: 60 * 60` (1h) — sensitive actions (e.g., `delete-user`) require a session authenticated within the last hour.

**Audit logging:** `databaseHooks` in `lib/auth.ts` call `recordAudit()` to log `session.created` (with real IP + user-agent), `user.created`, `user.updated` (role/banned snapshot), and `user.deleted` into the `AuditLog` table. Writes are best-effort (failures never break auth). Old entries are pruned by the `cleanup-audit-logs` scheduled job (90-day retention).

**Key files:**
- `apps/api/src/lib/auth.ts` - Server-side auth config and plugin setup
- `apps/api/src/lib/auth-guard.ts` - Auth guard functions (requireAuth, requireRole)
- `apps/dashboard/lib/auth-client.ts` - Client-side auth setup (`createAuthClient`)
- `apps/dashboard/lib/auth-server.ts` - Server utilities (`isAuthenticated` via cookie forwarding to API)

**Auth features:**
- Email/password authentication with **required** email verification (`requireEmailVerification: true`, `autoSignIn: false`)
- Password reset with email notifications (sends confirmation email after reset)
- Two-factor authentication (TOTP app, email OTP, backup codes)
- Global role-based access control (admin, user) via custom permissions in `shared/permissions.ts`
- Self-delete enabled (`user.deleteUser.enabled: true`)
- Email change disabled (`user.changeEmail.enabled: false`)
- Built-in rate limiting on `/api/auth/*` endpoints with per-route rules

**Cross-origin auth (cookies + credentials):** The dashboard talks to the API directly at `NEXT_PUBLIC_API_URL` with `credentials: 'include'`, so HttpOnly session cookies travel on every request. For deployments where the dashboard and API live on different subdomains of the same parent domain, set `COOKIE_DOMAIN=".example.com"` on the API (enables Better Auth `crossSubDomainCookies`) and `NEXT_PUBLIC_COOKIE_DOMAIN=".example.com"` on the dashboard (used by `/api/clear-session` to invalidate the cookie with the correct scope). In dev both run on `localhost`, so cookies just work without `COOKIE_DOMAIN`. Socket.io connects directly to the API using a token fetched server-side from `/api/socket-token` (HttpOnly cookies aren't readable from client JS). This relies on `sameSite: 'lax'`, which only works when dashboard and API share the same eTLD+1 (same-site); for truly different domains, switch the API cookie to `sameSite: 'none'` + `secure` (noted in `lib/auth.ts`).

### User Roles (Global)

Each user has a single global role stored in `user.role` (via Better Auth admin plugin). Default role for new users: `user`.

| Role | Key | Access |
|------|-----|--------|
| Admin | `admin` | Full access |
| User | `user` | Read-only access |

Defined in `packages/shared/src/roles.ts` as `ROLES`, `RoleType`, `ROLE_LABELS`, `ROLE_OPTIONS`.

### Custom Hooks (Web App)

Apps include hooks in `hooks/` directory:

```typescript
// useUserRole - Current user's global role + hasRole() + userId
import { useUserRole } from '@/hooks'
const { role, userId, isPending, hasRole } = useUserRole()
if (hasRole('admin')) { ... }

// useOnlineUsers - Set<userId> of currently online users (via Socket.io presence)
import { useOnlineUsers } from '@/hooks'

// useRealtimeInvalidation - Socket.io → React Query bridge (used internally)
import { useRealtimeInvalidation } from '@/hooks'
```

### UI Package

Located at `packages/ui/` with exports:
- `@workspace/ui/globals.css` - Global styles (Tailwind)
- `@workspace/ui/components/*` - shadcn/ui components (65+ components)
- `@workspace/ui/lib/utils` - Utility functions (`cn` for className merging)
- `@workspace/ui/hooks/*` - Shared React hooks

### App Providers Pattern

Apps wrap children in providers (see `apps/dashboard/providers/`):
- `QueryProvider` - React Query client (staleTime: 60s)
- `SocketProvider` - Socket.io lifecycle management
- `RealtimeInvalidation` - Renderless component activating socket→query bridge
- `ThemeProvider` - next-themes for dark mode

Provider nesting order (protected layout): `QueryProvider` → `SocketProvider` → `RealtimeInvalidation` → `TooltipProvider` → `ModalProvider` → `NuqsAdapter` → `SidebarProvider`

> `ThemeProvider` wraps the entire app in the root layout, outside of this stack.

### Environment Variables

**Web app** (`apps/dashboard/.env.local`):
- `NEXT_PUBLIC_API_URL` - Backend API URL, e.g., `http://localhost:3333` (required)
- `NEXT_PUBLIC_BASE_URL` - App base URL (required)
- `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DESCRIPTION`, etc. - App metadata (optional with defaults)
- `NEXT_PUBLIC_INDEXABLE` - SEO indexing toggle

**API** (`apps/api/.env`):
- `DATABASE_URL` - PostgreSQL connection string (required)
- `BETTER_AUTH_SECRET` - Auth secret key (required)
- `BETTER_AUTH_URL` - API base URL (required)
- `SITE_URL` - Frontend URL for auth callbacks (required)
- `TRUSTED_ORIGINS` - CORS allowed origins (required)
- `RESEND_API_KEY` - Resend API key for transactional emails
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `R2_*` - Cloudflare R2 storage credentials
- `REDIS_URL` - Redis connection string (required, enables BullMQ queues + cache)
- `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` - Bull Board UI auth (optional)
- `PORT` - API port (default: 3333)

See `apps/api/.env.example` for the full list.

## Tech Stack

- **Framework**: Next.js 16.x with App Router and Turbopack
- **React**: 19.x
- **API**: Fastify 5.x (high-performance REST API)
- **Database**: PostgreSQL 17 + Prisma 7.x ORM
- **Auth**: Better Auth 1.6.x with Prisma adapter (+ `@better-auth/i18n`)
- **Real-time**: Socket.io 4.x (token-based auth, global broadcast)
- **Background Jobs**: BullMQ 5.x + ioredis (requires Redis)
- **State**: React Query (@tanstack/react-query) 5.x
- **API Client**: @hey-api/openapi-ts (generated from OpenAPI spec)
- **Styling**: Tailwind CSS v4
- **UI**: shadcn/ui components (Radix primitives)
- **Forms**: react-hook-form + zod
- **Validation**: zod 4.x
- **Email**: react-email + Resend
- **File Storage**: Cloudflare R2 via AWS S3 SDK
- **AI**: Vercel AI SDK (OpenAI + Anthropic)
- **Animations**: framer-motion
- **URL State**: nuqs
- **Utilities**: sonner (toasts), lucide-react (icons), zustand (client state)
- **Package Manager**: pnpm 11.x
- **Node**: >= 22
