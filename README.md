# turborepo-saas-starter

[![CI](https://github.com/MatraTecnologia/turborepo-saas-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/MatraTecnologia/turborepo-saas-starter/actions/workflows/ci.yml)

Full-stack SaaS starter template built with Turborepo, Next.js 16, Fastify, Prisma, and Better Auth.

## Features

- **Monorepo** — Turborepo with pnpm workspaces
- **Frontend** — Next.js 16 (App Router, React 19, Tailwind CSS v4, shadcn/ui)
- **API** — Fastify 5 REST API with Swagger/Scalar docs
- **Database** — PostgreSQL + Prisma 7 ORM
- **Auth** — Better Auth (email/password, 2FA, role-based access)
- **Real-time** — Socket.io (presence tracking, automatic cache invalidation)
- **Background Jobs** — BullMQ + Redis
- **Storage** — Cloudflare R2 via S3 SDK (presigned URLs)
- **Email** — Resend + react-email templates
- **AI** — Vercel AI SDK (OpenAI + Anthropic ready)
- **UI** — 60+ shadcn/ui components (with Base UI primitives)
- **Docker** — Per-app multi-stage Dockerfiles using `turbo prune` (`apps/dashboard/Dockerfile`, `apps/api/Dockerfile`)
- **CI** — GitHub Actions runs lint/typecheck/build/boundaries on every push and PR (`.github/workflows/ci.yml`). To gate merges on it, see [docs/branch-protection.md](docs/branch-protection.md).
- **Dependency updates** — self-hosted Renovate opens grouped weekly PRs, each gated by CI (`.github/workflows/renovate.yml`). Setup: [docs/renovate.md](docs/renovate.md).

## Prerequisites

- Node.js >= 22
- pnpm >= 10
- PostgreSQL 17+
- Redis (for BullMQ + cache)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd turborepo-saas-starter

# 2. Install dependencies
pnpm install

# 3. Copy env files
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your DATABASE_URL and auth secrets

# 4. Push schema and generate client
pnpm db:push
pnpm db:generate

# 5. (Optional) Restore agent skills from lockfile
npx skills experimental_install

# 6. Start dev
pnpm dev
```

The dashboard runs at `http://localhost:3001` and the API at `http://localhost:3333`.

API docs available at `http://localhost:3333/docs` (Scalar UI).

Queue dashboard available at `http://localhost:3333/admin/queues` (requires Redis).

## Workspace Structure

```
apps/
  dashboard/              # Next.js app (port 3001) — landing, auth, admin panel
packages/
  api/                    # Fastify REST API (port 3333) — auth, routes, socket.io, queues
  api-client/             # Generated OpenAPI client (@hey-api/openapi-ts)
  ui/                     # Shared UI components (shadcn/ui, 65+ components)
  eslint-config/          # Shared ESLint config
  typescript-config/      # Shared TypeScript config
```

## Commands

```bash
pnpm dev              # Run all apps + API in parallel
pnpm dev:dashboard    # Run only the dashboard app
pnpm dev:api          # Run only the API server
pnpm build            # Build all apps and packages
pnpm lint             # Lint all workspaces
pnpm typecheck        # Type check all workspaces
pnpm format           # Format with Prettier
pnpm clean            # Remove all build artifacts and node_modules

# Database
pnpm db:generate      # Generate Prisma client + Zod schemas
pnpm db:push          # Sync schema to database
pnpm db:reset         # Force-reset schema and regenerate (drops all data)
pnpm db:studio        # Open Prisma Studio GUI

# Redis
pnpm redis:flush      # FLUSHALL on REDIS_URL (clears cache + queues)

# API Client
pnpm generate:api     # Regenerate OpenAPI client from API spec
```

## Architecture

### Auth Flow

Better Auth handles email/password authentication with email verification, password reset, and two-factor authentication (TOTP, email OTP, backup codes). The frontend talks to the API directly at `NEXT_PUBLIC_API_URL` with `credentials: 'include'`, so HttpOnly session cookies travel on every request. For multi-app deployments where the dashboard and API live on different subdomains of the same parent domain, set `COOKIE_DOMAIN` / `NEXT_PUBLIC_COOKIE_DOMAIN` to the shared parent (e.g., `.example.com`) — Better Auth's `crossSubDomainCookies` is enabled automatically. Socket.io connects directly to the API using token-based auth.

### Real-time

The API emits `entity:mutated` Socket.io events after mutations. The frontend listens via `useRealtimeInvalidation` and automatically invalidates the matching React Query caches (tag-based matching). No full data is sent over the wire — only entity type, action, and ID.

### API Client Generation

The `api-client` package is auto-generated from the API's OpenAPI spec using `@hey-api/openapi-ts`. It provides SDK functions, React Query integration (query keys + options), and TypeScript types. Regenerate after API route changes with `pnpm generate:api`.

### Role System

Each user has a single global role (via Better Auth admin plugin). Default role for new users: `user`.

| Role | Key | Access |
|------|-----|--------|
| Admin | `admin` | Full access |
| User | `user` | Read-only access |

## Environment Variables

### Dashboard (`apps/dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (e.g., `http://localhost:3333`) |
| `NEXT_PUBLIC_BASE_URL` | Yes | App base URL (e.g., `http://localhost:3001`) |
| `NEXT_PUBLIC_APP_NAME` | No | App name (default: "SaaS Starter") |
| `NEXT_PUBLIC_INDEXABLE` | No | Enable search indexing (default: false) |

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Auth encryption secret |
| `BETTER_AUTH_URL` | Yes | API base URL (e.g., `http://localhost:3333`) |
| `SITE_URL` | Yes | Frontend URL for auth callbacks |
| `TRUSTED_ORIGINS` | Yes | CORS allowed origins |
| `RESEND_API_KEY` | No | Resend API key for transactional emails |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `R2_*` | No | Cloudflare R2 storage credentials |
| `REDIS_URL` | No | Redis connection string (enables BullMQ queues) |
| `BULL_BOARD_USER` | No | Bull Board UI username |
| `BULL_BOARD_PASSWORD` | No | Bull Board UI password |
| `PORT` | No | API port (default: 3333) |

See `apps/api/.env.example` for the full list.

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router + Turbopack) | 16.x |
| React | React | 19.x |
| API | Fastify | 5.x |
| Database | PostgreSQL + Prisma ORM | 17 / 7.x |
| Auth | Better Auth + Prisma adapter | 1.6.x |
| Real-time | Socket.io | 4.x |
| Background Jobs | BullMQ + ioredis | 5.x |
| State | React Query (@tanstack/react-query) | 5.x |
| API Client | @hey-api/openapi-ts (generated) | 0.97.x |
| Styling | Tailwind CSS | v4 |
| UI Components | shadcn/ui (Radix + Base UI) | latest |
| Forms | react-hook-form + zod | latest |
| Validation | zod | 4.x |
| Email | react-email + Resend | latest |
| File Storage | Cloudflare R2 (AWS S3 SDK) | latest |
| AI | Vercel AI SDK (OpenAI + Anthropic) | 6.x |
| Animations | framer-motion | 12.x |
| URL State | nuqs | 2.x |
| Package Manager | pnpm | 10.33.x |
| Build Tool | Turborepo | 2.x |

## Agent Skills

This repo uses [agent skills](https://agentskills.io) to teach coding assistants project conventions for Better Auth. The actual skill files (`.agents/`, `.claude/skills/`) are gitignored — only `skills-lock.json` is versioned.

To restore the same skill set after cloning:

```bash
npx skills experimental_install
```

To add more skills:

```bash
npx skills add <owner>/<repo>
```

## License

MIT
