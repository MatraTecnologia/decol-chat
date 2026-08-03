# @workspace/api

Backend Node.js for turborepo-saas-starter.

**Stack:** Fastify 5 + Prisma 7 (PostgreSQL) + Better Auth + Socket.io + BullMQ + Resend

## Commands

```bash
pnpm dev              # tsx --watch src/index.ts (hot-reload)
pnpm build            # tsc + tsc-alias → dist/
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # prisma generate + tsx scripts/fix-zod-imports.ts (adds .js extension for ESM)
pnpm db:push          # prisma db push — sync schema to database
pnpm db:reset         # prisma db push --force-reset + regenerate (DROPS ALL DATA)
pnpm db:studio        # prisma studio
pnpm redis:flush      # tsx scripts/redis-flush.ts (FLUSHALL on REDIS_URL)
```

## Prisma Zod Generator

The project uses `prisma-zod-generator` to auto-generate Zod schemas from the Prisma schema. Generated output lives in `src/generated/zod/schemas.ts` (single-file output, auto-generated, do not edit).

**Config:** `prisma/zod-generator.config.json` (mode: `full`, variants: `pure`, `input`, `result`)

**Generation:** Runs automatically with `pnpm db:generate` (`prisma generate`).

**Primary usage — enum schemas used directly in route Zod schemas:**

```typescript
import { RoleSchema } from '@/generated/zod/schemas.js'

// Use directly as Zod schemas in route definitions
role: RoleSchema
```

These generated schemas are `z.enum(...)` instances — use them directly in Zod route schemas. They are the single source of truth for Prisma enums.

**Prisma models:** User, Session, Account, Verification, TwoFactor, RateLimit (auth infrastructure) + AuditLog (application audit trail — `id` uses `@default(cuid(2))`).

## Structure

```
src/
├── index.ts              # Entry point (listen)
├── server.ts             # Fastify app builder + plugin registration
├── env.ts                # Typed env validation (@t3-oss/env-core + zod)
├── generated/prisma/     # Prisma client (auto-generated, do not edit)
├── generated/zod/        # Zod schemas from Prisma (auto-generated, do not edit)
│   └── schemas.ts        # Single-file output with all schemas
├── lib/                  # Singletons and helpers
│   ├── prisma.ts         # PrismaClient singleton (PrismaPg adapter)
│   ├── auth.ts           # Better Auth instance
│   ├── auth-guard.ts     # requireAuth, requireRole (locale-aware error messages)
│   ├── audit.ts          # recordAudit() — best-effort audit log writer (AuditLog model)
│   ├── locale.ts         # getLocale(request) + t(locale, key) — locale detection util
│   ├── cache.ts          # Redis cache helper (get, set, del, invalidate)
│   ├── cors.ts           # CORS origins config + isAllowedOrigin()
│   ├── email.ts          # Resend client + sendEmail()
│   ├── storage.ts        # R2 S3Client singleton (two buckets) + helpers
│   ├── ai.ts             # AI model registry (ai-sdk) — exports `models`, `modelMeta`, `defaultModel`, `ModelId`. Includes gpt-4o, gpt-4o-mini, gpt-4.1, gpt-5 variants, o3-mini, o4-mini
│   ├── redis.ts          # Redis client singleton (ioredis, REDIS_URL required)
│   ├── queue.ts          # BullMQ queue/worker factory + registry
│   ├── socket.ts         # Socket.io server setup (auth via cookie/token)
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
├── types/                # TypeScript type augmentations
│   └── fastify.d.ts      # Declares app.io, app.emitRealtimeEvent, request.locale, request.t
├── routes/               # Autoloaded by @fastify/autoload
│   ├── health.ts         # /health, /health/live, /health/ready
│   ├── members/index.ts  # /members (lists non-`user` roles only — i.e. staff/admins)
│   └── users/index.ts    # /users (paginated list with search/role/banned/isStaff filters)
├── emails/               # react-email templates (i18n-ready, pt-BR + en)
│   ├── index.ts              # Re-exports all render functions
│   ├── translations.ts       # Email string translations (emailT: pt-BR, en)
│   ├── get-email-locale.ts   # Locale detection from Web API Request
│   ├── verification.tsx      # Email verification template
│   ├── reset-password.tsx    # Password reset template
│   ├── reset-confirmation.tsx # Password reset confirmation template
│   ├── two-factor-otp.tsx    # 2FA OTP code template
│   └── styles.ts             # Shared CSS-in-JS styles
├── shared/               # Shared constants (roles/permissions/auth-cookie now live in @workspace/shared)
│   ├── i18n.ts           # Better Auth translation dictionaries (en, pt-BR)
│   └── locale.ts         # App-level translation messages (NOT_FOUND, FORBIDDEN, etc.)
├── utils/
│   ├── generate-id.ts    # cuid2 ID generator
│   └── pagination.ts     # Offset-based pagination helper (paginate, schemas)
└── scripts/              # (sibling to src/) — helper TS scripts run via tsx
    ├── fix-zod-imports.ts # Post-prisma-generate: appends .js extension to relative imports in generated zod schemas (required by NodeNext ESM)
    └── redis-flush.ts    # FLUSHALL on REDIS_URL — exposed via pnpm redis:flush
```

## Plugin Registration Order

Plugins are registered in `server.ts` in this order:

1. `@fastify/sensible` — HTTP error decorators
2. `@fastify/cookie` — Session cookie support
3. `locale` — Locale detection → `request.locale` + `request.t()` (after cookie, before routes)
4. `@fastify/helmet` — Security headers
5. `@fastify/cors` — CORS handling
6. `@fastify/rate-limit` — Rate limiting (500 req/min, globally)
7. `@fastify/compress` — Response compression (gzip/deflate, 1KB threshold)
8. `@fastify/etag` — Conditional caching (304 Not Modified)
9. `@fastify/under-pressure` — Health monitoring + graceful degradation (503 when overloaded; enabled by default, disable with `UNDER_PRESSURE_ENABLED=false`)
10. `swagger` — OpenAPI docs
11. `auth` — Better Auth catch-all
12. `socket` — Socket.io + emitRealtimeEvent
13. `queue` — BullMQ queue initialization
14. `bull-board` — Bull Board UI dashboard
15. `@fastify/autoload` — Route auto-loading

> Every response gets an `X-Request-Id` header propagated from `request.id` via an `onRequest` hook in `server.ts` — useful for cross-service tracing.

## Route Conventions

### File structure

- Routes live in `src/routes/` and are autoloaded via `@fastify/autoload` with `dirNameRoutePrefix: true`.
- Each domain gets a **directory** with an `index.ts` (e.g., `routes/users/index.ts` → `/users`).
- Sub-resources are separate files registered as plugins in the parent `index.ts`.
- Simple routes without sub-resources can be a single file (e.g., `routes/health.ts` → `/health`).
- Resource-level authorization logic lives in `guards.ts` files within each route directory.

### Route definition pattern

Routes use `fastify-type-provider-zod` for type-safe validation. Zod schemas define params, querystring, body, and response — TypeScript types are inferred automatically (no manual generics needed).

```typescript
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '@/lib/prisma.js'
import { requireRole } from '@/lib/auth-guard.js'

const myRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/:id',
    {
      schema: {
        tags: ['MyDomain'],
        summary: 'Get item by ID',
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, ['admin'])
      request.params.id // fully typed, no manual generic needed
    },
  )
}

export default myRoutes
```

### Key rules

1. **Every route must have `schema`** with at least `tags` and `summary` for Swagger docs.
2. **Body/params/querystring/response use Zod schemas** — `fastify-type-provider-zod` converts them to JSON Schema for Swagger and infers TypeScript types.
3. **Enum values** from Prisma use generated Zod schemas directly. They are `z.enum(...)` instances.
4. **Zod schemas** for params/body are defined as `const` variables at the top of the file.
5. **Use `.nullable()`** for fields that accept `null`, `.optional()` for fields that can be omitted, `.nullable().optional()` for both.
6. **No manual TypeScript generics** on route handlers — types are inferred from the Zod schemas.

### Auth guards

```typescript
// Any authenticated user
const session = await requireAuth(request)

// Must have specific global role(s) — returns { session, role }
const { session, role } = await requireRole(request, ['admin'])

// For read-only endpoints accessible to all roles:
const { session, role } = await requireRole(request, ['admin', 'user'])
```

### Error responses

Use `@fastify/sensible` decorators on `reply`. Pass locale-aware messages via `request.t()`:

```typescript
return reply.notFound(request.t('NOT_FOUND'))       // 404
return reply.forbidden(request.t('FORBIDDEN'))      // 403
return reply.badRequest('Campo X é obrigatório')    // 400 (mensagens de validação podem ser fixas)
```

`request.t(key, fallback?)` looks up the message key in `shared/locale.ts` using the detected locale. If the key is not found, returns the fallback or the key itself.

### Prisma JSON fields

```typescript
import { Prisma } from '@/generated/prisma/client.js'

// Writing null to JSON column
data: { metadata: metadata === null ? Prisma.JsonNull : metadata }

// Typing JSON input
Body: { metadata?: Prisma.InputJsonValue | null }
```

### Realtime events (Socket.io)

After every mutation, the backend emits a lightweight `entity:mutated` Socket.io event via global broadcast. The frontend listens and invalidates the corresponding React Query cache (triggers refetch). No full data is sent over the wire — only entity type, action, and ID.

**Architecture:**
- `lib/socket.ts` — Creates Socket.io server with dual auth (cookie-based + token-based for proxied connections)
- `lib/realtime-events.ts` — Defines `RealtimeEvent` type, `RealtimeEntity`, `RealtimeAction`, and `REALTIME_EVENT` constant
- `plugins/socket.ts` — Fastify plugin (wrapped with `fastify-plugin` for encapsulation breaking) that decorates `app.emitRealtimeEvent()`
- `types/fastify.d.ts` — Augments `FastifyInstance` with `io` and `emitRealtimeEvent`

**Emitting events in route handlers:**

```typescript
app.emitRealtimeEvent({
  entity: 'user',
  action: 'updated',
  entityId: user.id,
})
```

**Supported entities:**

| Entity | Invalidation Tags |
|--------|-------------------|
| `user` | `Users` |
| `whatsappConnection` | `WhatsApp` |
| `whatsapp-template` | `WhatsAppTemplates` |
| `conversation` | `Conversations` |
| `message` | `Messages`, `Conversations` |
| `contact` | `Contacts`, `Conversations` |

**Supported actions:** `created`, `updated`, `deleted`

**Payload:** `payload` carries the entity body when the client must apply the change without refetch (`message created` e `message updated` mandam o item no formato de `listMessages`). Nunca inclua token, credencial ou dado sensível — o evento vai para todos os clientes conectados.

**Emissão fora de rota:** quem muda estado sem ter o `app` em mãos (hoje só os `databaseHooks` do Better Auth, que cobrem as mutações de usuário do plugin admin) usa `emitRealtime()` de `lib/realtime.ts` — ponte para o mesmo emissor decorado pelo `socketPlugin`. A emissão é best-effort: falhar nela nunca derruba a requisição.

**Tag-based invalidation:** Each entity maps to Swagger tags via `ENTITY_INVALIDATION_TAGS` in `lib/realtime-events.ts`. The frontend uses these tags to invalidate React Query caches (both via socket events and manual `invalidateByTags()` calls). When adding a new entity, add it to `ENTITY_INVALIDATION_TAGS` with the corresponding Swagger `tags`.

**Broadcast model:** Events are broadcast to all connected authenticated clients via `io.emit()`.

### User enrichment

When returning data that references user IDs, batch-fetch users:

```typescript
const userIds = [...new Set(items.map(i => i.userId))]
const users = await prisma.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, name: true, email: true, image: true },
})
const usersMap = Object.fromEntries(users.map(u => [u.id, u]))
```

Or use Prisma `include` for direct relations (e.g., `members` route).

## Storage Helper

`lib/storage.ts` provides a lazy-initialized R2 S3Client with helper functions for presigned URLs and bulk deletion.

```typescript
import {
  r2,
  R2_PRIVATE_BUCKET,
  R2_PUBLIC_BUCKET,
  R2_PUBLIC_URL,
  getUploadUrl,
  getDownloadUrl,
  getFile,
  headFile,        // returns { contentLength }
  uploadFile,
  deleteFile,
  deleteFiles,     // bulk delete up to 1000 keys per batch
} from '@/lib/storage.js'

// Generate presigned upload URL
const uploadUrl = await getUploadUrl(R2_PUBLIC_BUCKET, 'path/to/file.jpg', {
  contentLength: 1024,
  contentType: 'image/jpeg',
  expiresIn: 3600,  // optional, default 3600s
})

// Generate presigned download URL
const downloadUrl = await getDownloadUrl(R2_PRIVATE_BUCKET, 'path/to/file.pdf')

// Bulk delete (returns keys that failed)
const failed = await deleteFiles(R2_PUBLIC_BUCKET, ['key1', 'key2', 'key3'])
```

## User Presence

`lib/presence.ts` tracks real-time user online/offline status in memory. Integrated into `lib/socket.ts`.

```typescript
import { presence } from '@/lib/presence.js'

presence.add(userId, socketId)           // User connected
presence.remove(userId, socketId, () => {
  // Called after 30s grace period when user goes fully offline
})
presence.isOnline(userId)                // boolean
presence.getOnlineUserIds()              // string[]
presence.clear()                         // Clear all (shutdown)
```

The 30-second grace period handles reconnections gracefully (e.g., page refresh).

## Access Control (Permissions)

`packages/shared/src/permissions.ts` defines granular action-based access control using `better-auth/plugins/access`.

```typescript
import { ac, admin, user } from '@workspace/shared/permissions'

// Role capabilities:
// admin: member(read), full access to all resources
// user:  member(read), read-only access
```

## Better Auth Configuration (`lib/auth.ts`)

Active plugins:

| Plugin | Purpose |
|--------|---------|
| `admin({ ac, roles })` | Role-based access control with the custom permissions above |
| `twoFactor` | TOTP + backup codes |
| `emailOTP` | Email-delivered OTP codes (used by 2FA flow) |
| `openAPI` | OpenAPI docs at `/api/auth/openapi` |
| `i18n` (`@better-auth/i18n`) | Localizes auth error messages (`en`, `pt-BR` from `shared/i18n.ts`) |

**Session & rate-limit storage:** Redis is configured as Better Auth `secondaryStorage` (`@better-auth/redis-storage`, `keyPrefix: 'better-auth:'`), accelerating session reads and holding the rate-limit counters (`rateLimit.storage: 'secondary-storage'`). **PostgreSQL is kept as the source of truth**: `session.storeSessionInDatabase: true` + `verification.storeInDatabase: true` write sessions and verification records to the DB too, so a Redis flush/eviction does **not** force logouts, and the audit hook / cleanup job / admin session listing keep working. Redis reuses the shared `lib/redis.js` singleton. (Verified end-to-end on 1.6.23: with the session key deleted from Redis, `get-session?disableCookieCache=true` still returns the session from Postgres; a password-reset token lands in both `verification` and Redis. Note: the email-verification-on-signup token is a stateless signed token, so it does **not** create a `verification` row — that's expected, not a bug.)

> Note: rate-limit counters live in Redis (`secondary-storage`), so they persist across restarts and are shared across replicas. In production, set Redis `maxmemory-policy noeviction` (+ AOF) so auth keys are never evicted — see `docs/better-auth-production-playbook.md` §6.

**Session cookie cache:** `session.cookieCache` (`maxAge: 60s`) caches the session in a short-lived signed cookie (`turboreposaasstarter.session_data`, `__Secure-` in prod), cutting the `get-session` round-trip on hard loads. The dashboard's `/api/clear-session` expires this cookie too (`SESSION_DATA_COOKIE`). Trade-off: revocation/role changes propagate with up to `maxAge` delay.

**User configuration:**
- `additionalFields.phone: { type: 'string', required: false }` — exposed to the client via `inferAdditionalFields`.
- `deleteUser.enabled: true` — self-delete supported.
- `changeEmail.enabled: false` — email change disabled.

**Email/password flow:**
- `requireEmailVerification: true` + `autoSignIn: false` — users must verify before signing in.
- `emailVerification.sendOnSignIn: true` — re-sends verification on login attempt if unverified.
- `emailVerification.autoSignInAfterVerification: false` — no auto-login after verification.
- `onPasswordReset` callback sends a confirmation email after password reset.

**Bootstrap rule (important):** `databaseHooks.user.create.before` checks if the user count is zero. If it is, the first user created is forced to `role: 'admin'`. Subsequent signups default to `user`. This means the first signup on a fresh DB becomes the system admin.

**Session freshness:** `session.freshAge: 60 * 60` (1h) — sensitive actions (e.g., `delete-user`) require a session authenticated within the last hour.

**Audit logging:** `databaseHooks` call `recordAudit()` (`lib/audit.ts`) to write into the `AuditLog` table:

| Hook | Event | Captured |
|------|-------|----------|
| `session.create.after` | `session.created` | `userId`, `ip` (real client IP), `userAgent` |
| `user.create.after` | `user.created` | `userId` |
| `user.update.after` | `user.updated` | `userId`, `metadata: { role, banned }` |
| `user.delete.after` | `user.deleted` | `userId` |

Writes are best-effort — `recordAudit()` swallows errors so auditing never breaks the auth flow (same posture as `cache.ts`). Old entries are pruned by the `cleanup-audit-logs` scheduled job (90-day retention; requires Redis/BullMQ). Query via `prisma.auditLog.findMany(...)` or Prisma Studio.

**IP resolution / proxy:** Fastify runs with `trustProxy: 1` (`server.ts`) so `request.ip` resolves the real client IP from the last `X-Forwarded-For` hop (spoof-safe behind a single edge proxy like Traefik/EasyPanel). Better Auth's internal rate limiter reads it via `advanced.ipAddress.ipAddressHeaders: ['x-forwarded-for']`. If you add another proxy/CDN in front of Traefik, bump `trustProxy` to the number of hops.

**Internal rate limiting:** Better Auth has its own rate limiter (independent of `@fastify/rate-limit`) with per-endpoint rules — e.g. `/sign-up/email: 3/min`, `/sign-in/email: 5/30s`, `/forget-password: 3/min`. Configured inline in `lib/auth.ts`.

**Cookie prefix:** `advanced.cookiePrefix` is set to `AUTH_COOKIE_PREFIX` (`turboreposaasstarter`, from `packages/shared/src/auth-cookie.ts`), so the session cookie is `turboreposaasstarter.session_token` (`__Secure-` prefixed in production). Consumers (dashboard proxy, socket-token, clear-session, socket auth) import `SESSION_COOKIE` / `SECURE_SESSION_COOKIE` from `@workspace/shared/auth-cookie` instead of hardcoding names.

**Cross-subdomain cookies:** Setting `COOKIE_DOMAIN` enables `advanced.crossSubDomainCookies` so the session cookie is scoped to a shared parent domain (e.g., `.example.com`).

**`sameSite` (cookie):** `defaultCookieAttributes.sameSite: 'lax'` works when dashboard and API are **same-site** (same eTLD+1) — current EasyPanel subdomains, or `app.example.com` + `api.example.com` (set `COOKIE_DOMAIN` in that case). ⚠️ If they ever live on **different eTLD+1 domains** (e.g., `app.com` + `api.other-domain.com`), the browser won't send the cookie on cross-site fetch with `'lax'` and login breaks — switch to `sameSite: 'none'` + `secure: true` (see the note in `lib/auth.ts`).

## Background Jobs (BullMQ)

The API includes a background job system powered by BullMQ + Redis. `REDIS_URL` is required — queues and workers are always initialized.

### Queue/Worker factory

```typescript
import { createQueue, createWorker } from '@/lib/queue.js'

// Create a typed queue
const myQueue = createQueue<{ message: string }>('my-job')

// Create a worker
const worker = createWorker<{ message: string }>('my-job', async job => {
  console.log(job.data.message)
})
```

### Job defaults

- 3 retry attempts with exponential backoff (1s initial)
- Auto-removes completed jobs (keeps last 500)
- Auto-removes failed jobs (keeps last 1000)
- Queue prefix: `saas:${NODE_ENV}`

### Job registration pattern

1. Define job in `src/jobs/my-job.ts`
2. Register queue + worker in `plugins/queue.ts`
3. Add cleanup hooks (`onClose`) for graceful shutdown

See `src/jobs/example.ts` for the reference implementation.

### Scheduled Jobs

Scheduled (cron) jobs live in `src/jobs/scheduled/`. They use BullMQ repeatable jobs.

**Available jobs:**
- `cleanup-sessions` — Deletes expired sessions daily at 3:00 AM (`0 3 * * *`)
- `cleanup-audit-logs` — Deletes audit logs older than 90 days, daily at 3:30 AM (`30 3 * * *`)

**Registration:** Import and call `registerXxxJob(app)` in `plugins/queue.ts` under the "Scheduled jobs" section.

```typescript
import { registerCleanupSessionsJob } from '@/jobs/scheduled/cleanup-sessions.js'
import { registerCleanupAuditLogsJob } from '@/jobs/scheduled/cleanup-audit-logs.js'

// Inside queuePlugin:
registerCleanupSessionsJob(app)
registerCleanupAuditLogsJob(app)
```

### Bull Board UI

- **Dashboard:** `http://localhost:3333/admin/queues`
- Protected with HTTP Basic Auth (optional, via `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`)
- Auto-discovers all registered queues via `getRegisteredQueues()`

## Cache Helper

`lib/cache.ts` provides a Redis-backed cache. Runtime errors are swallowed (reads fall through to a cache miss) so a transient Redis failure never breaks a request.

```typescript
import { cache } from '@/lib/cache.js'

await cache.set('key', { data: 'value' }, 300)  // TTL in seconds (optional)
const data = await cache.get<MyType>('key')      // Returns T | null
await cache.del('key')                           // Delete single key
await cache.invalidate('prefix:*')               // Delete keys matching glob pattern
```

## Pagination Helper

`utils/pagination.ts` provides offset-based pagination for Prisma queries.

**Exports:**
- `paginationQuerySchema` — Zod schema for `page` (default: 1) and `limit` (default: 20, max: 100) querystring params
- `paginatedResponseSchema(itemSchema)` — Wraps an item Zod schema into `{ data: T[], meta: { total, page, limit, totalPages, hasNext } }`
- `paginate<T>(model, params, options)` — Executes a paginated Prisma query (parallel `findMany` + `count`)

```typescript
import { paginationQuerySchema, paginate } from '@/utils/pagination.js'

app.get('/', {
  schema: {
    querystring: paginationQuerySchema,
  },
}, async (request) => {
  return paginate(prisma.user, request.query, {
    orderBy: { createdAt: 'desc' },
  })
})
// → { data: [...], meta: { total: 150, page: 1, limit: 20, totalPages: 8, hasNext: true } }
```

## Health Probes

The health route (`routes/health.ts`) exposes three endpoints for container orchestration:

| Endpoint | Purpose | I/O | Response |
|----------|---------|-----|----------|
| `GET /health` | General health check | DB + Redis | `200 ok` / `503 degraded` |
| `GET /health/live` | Liveness probe | None | `200 alive` |
| `GET /health/ready` | Readiness probe | DB + Redis | `200 ready` / `503 not_ready` |

Additionally, when `UNDER_PRESSURE_ENABLED=true`, `@fastify/under-pressure` auto-registers `GET /health/pressure` (hidden from Swagger) which returns 503 when event loop delay, heap, or RSS exceed configured thresholds (2000ms delay, 2GB heap, 2.5GB RSS).

## User Roles (Global)

Each user has a single global role stored in `user.role` (via Better Auth admin plugin). Default role for new users: `user`.

| Role | Key | Access |
|------|-----|--------|
| Admin | `admin` | Full access |
| User | `user` | Read-only access |

Defined in `@workspace/shared` (`packages/shared/src/roles.ts`) as `ROLES`, `RoleType`, `ROLE_LABELS`, `ROLE_OPTIONS`.

## Locale / i18n

Every request has `request.locale` and `request.t()` available, injected by `plugins/locale.ts` via an `onRequest` hook.

**Detection order:** cookie `locale` → `Accept-Language` header → fallback `pt-BR`

**Supported locales:** `pt-BR` (default), `en`

```typescript
// Em route handlers:
return reply.notFound(request.t('NOT_FOUND'))         // usa locale do request
return reply.forbidden(request.t('FORBIDDEN'))

// Com fallback explícito:
return reply.notFound(request.t('MY_KEY', 'Não encontrado'))
```

**Adicionar mensagens** em `shared/locale.ts` nas duas línguas:

```typescript
export const appMessages = {
  'pt-BR': {
    MY_KEY: 'Minha mensagem em português',
  },
  en: {
    MY_KEY: 'My message in English',
  },
}
```

**Better Auth i18n** (`shared/i18n.ts`) é independente — as traduções do Better Auth são usadas pelo plugin `@better-auth/i18n` configurado em `lib/auth.ts` e cobrem os erros das rotas `/api/auth/*`. O `appMessages` em `shared/locale.ts` cobre os erros das rotas customizadas do Fastify.

### Email i18n

Os templates de email são i18n-ready. Cada função `render*` aceita `locale?: string` como último parâmetro.

```typescript
// Traduções em src/emails/translations.ts
import { emailT, type EmailLocale } from './translations.js'

const t = emailT[(locale as EmailLocale) ?? 'pt-BR'] ?? emailT['pt-BR']
// t.verification.heading, t.greeting(firstName), t.copyright(year), etc.
```

**Detecção de locale nos callbacks do Better Auth:**

Better Auth passa um `Request` (Web API padrão, não FastifyRequest) como segundo argumento nos callbacks de email. Use `getEmailLocale()` para extrair o locale:

```typescript
import { getEmailLocale } from '@/emails/get-email-locale.js'

// emailAndPassword / emailVerification callbacks:
sendVerificationEmail: async ({ user, url }, request) => {
  const locale = getEmailLocale(request)
  const html = await renderVerificationEmail(url, user.name, locale)
}

// emailOTP / twoFactor callbacks recebem GenericEndpointContext:
sendVerificationOTP: async ({ email, otp }, ctx) => {
  const locale = getEmailLocale((ctx as { request?: Request } | undefined)?.request)
}
```

**Adicionar traduções de email:** editar `src/emails/translations.ts` e adicionar a chave nas duas locales (`pt-BR` e `en`).

## Imports

Path alias `@/*` maps to `src/*`. Use `@/` for cross-directory imports; keep `./` for same-directory or subdirectory imports.

```typescript
// Prisma client + types
import { Prisma } from '@/generated/prisma/client.js'

// Generated Zod enum schemas (single-file import)
import { RoleSchema } from '@/generated/zod/schemas.js'

// Zod type provider (for route plugin type)
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

// Auth guards
import { requireAuth, requireRole } from '@/lib/auth-guard.js'

// Database
import { prisma } from '@/lib/prisma.js'

// Storage
import { r2, R2_PRIVATE_BUCKET, R2_PUBLIC_BUCKET, R2_PUBLIC_URL, getUploadUrl, getDownloadUrl, deleteFiles } from '@/lib/storage.js'

// Redis, Cache & Queues
import { redis } from '@/lib/redis.js'
import { cache } from '@/lib/cache.js'
import { createQueue, createWorker } from '@/lib/queue.js'

// Realtime events
import { REALTIME_EVENT } from '@/lib/realtime-events.js'

// Presence
import { presence } from '@/lib/presence.js'

// Permissions
import { ac, admin, user } from '@workspace/shared/permissions'

// Utils
import { generateId } from '@/utils/generate-id.js'
import { paginationQuerySchema, paginatedResponseSchema, paginate } from '@/utils/pagination.js'
```

All imports use `.js` extensions (ESM with `"type": "module"`).

## Package Exports

`@workspace/api` is a deployable application (lives in `apps/api`) and no longer exposes any subpath exports. Browser-safe shared constants previously imported from `@workspace/api/*` now live in the `@workspace/shared` package:

| Import | Provides |
|--------|----------|
| `@workspace/shared/roles` | `ROLES`, `RoleType`, `ROLE_LABELS`, `ROLE_OPTIONS` |
| `@workspace/shared/auth-cookie` | `AUTH_COOKIE_PREFIX`, `SESSION_COOKIE`, `SECURE_SESSION_COOKIE` |
| `@workspace/shared/permissions` | `ac`, `admin`, `user` (Better Auth access control) |

> `@workspace/shared` is a compiled package (`tsc` → `dist`). It is built automatically before `apps/api` via Turborepo's `^build` dependency. The Prisma client and generated Zod schemas are internal to `apps/api` and are not exported.

## Swagger / API Docs

- **API docs:** `http://localhost:3333/docs` (Scalar UI)
- **OpenAPI JSON:** `http://localhost:3333/docs/openapi.json`
- **Auth OpenAPI:** `http://localhost:3333/api/auth/openapi` (separate tab in Scalar)
- **Bull Board:** `http://localhost:3333/admin/queues` (queue monitoring)
- **Pressure status:** `http://localhost:3333/health/pressure` (auto-registered by `@fastify/under-pressure` when enabled, hidden from Swagger)
- Auth routes (`/api/auth/*`) are hidden from the main API tab via `{ schema: { hide: true } }`.

## Environment Variables

See `.env.example` for all required variables. Validated at startup via `@t3-oss/env-core`.

Key variables (status reflects the actual `src/env.ts` schema — running the API without a "Yes" var fails at boot unless `SKIP_ENV_VALIDATION=true`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Auth session encryption key |
| `BETTER_AUTH_URL` | Yes | API base URL |
| `SITE_URL` | Yes | Frontend URL for auth callbacks |
| `TRUSTED_ORIGINS` | Yes | CORS allowed origins (comma-separated) |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `EMAIL_FROM` | Yes | Sender name and address |
| `OPENAI_API_KEY` | Yes | OpenAI API key (used by `lib/ai.ts`) |
| `R2_PUBLIC_URL` | Yes | Public R2 URL (for the public bucket) |
| `R2_ENDPOINT` | Yes | R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret access key |
| `R2_PUBLIC_BUCKET_NAME` | Yes | R2 public bucket name |
| `R2_PRIVATE_BUCKET_NAME` | Yes | R2 private bucket name |
| `APP_NAME` | No | App name for logs / metadata (default: `SaaS App`) |
| `NODE_ENV` | No | `development` / `production` / `test` (default: `development`) |
| `COOKIE_DOMAIN` | No | Shared cookie domain (e.g., `.example.com`) — enables Better Auth `crossSubDomainCookies` |
| `REDIS_URL` | Yes | Redis connection string (BullMQ queues + cache helper) |
| `BULL_BOARD_USER` | No | Bull Board UI username |
| `BULL_BOARD_PASSWORD` | No | Bull Board UI password |
| `UNDER_PRESSURE_ENABLED` | No | Enable `@fastify/under-pressure` health monitoring (default: **`true`**, set to `false` to disable) |
| `PORT` | No | API port (default: 3333) |
| `HOST` | No | Bind address (default: 0.0.0.0) |

> **Tip:** in dev you can prefix the start command with `SKIP_ENV_VALIDATION=true` to start the server without populating Resend, OpenAI, or R2 vars — the corresponding features will fail at runtime, but the rest of the API boots.
