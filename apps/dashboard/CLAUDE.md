# apps/dashboard

Frontend Next.js for the turborepo-saas-starter. Protected dashboard for authenticated users.

**Stack:** Next.js 16 (App Router) + React 19 + React Query + Better Auth + Socket.io + Tailwind CSS v4

## Commands

```bash
pnpm dev          # next dev --port 3001 (Turbopack)
pnpm build        # next build (standalone output)
pnpm start        # next start
pnpm lint         # eslint
pnpm lint:fix     # eslint --fix
pnpm typecheck    # tsc --noEmit
```

> **Port note:** the dashboard runs on **3001**, not 3000, because port 3000 is commonly used by other tools. The API runs on 3333.

## Structure

```
apps/dashboard/
├── app/                        # Next.js App Router
│   ├── (root)/                 # Public pages (landing)
│   ├── (auth)/                 # Auth pages with two-column branded layout (custom fonts)
│   │   ├── _components/        # auth-layout-provider.tsx (branding + form columns)
│   │   ├── sign-in/, sign-up/, forgot-password/, reset-password/, two-factor/
│   ├── (protected)/            # Authenticated pages (sidebar layout)
│   │   ├── (general)/          # dashboard/ (welcome page)
│   │   └── admin/              # Admin panel — wrapped in AdminGate
│   │       ├── (root)/         # Redirects to /admin/users (placeholder for /admin)
│   │       └── users/          # Users management with table, search, role filter
│   ├── api/
│   │   ├── socket-token/       # GET — extracts HttpOnly session cookie for Socket.io auth
│   │   └── clear-session/      # GET — clears auth cookies and redirects to /sign-in
│   ├── not-authorized/         # Shown to users with role='user' (button to sign out)
│   ├── loading.tsx             # Global FullScreenLoader
│   ├── error.tsx               # Global error boundary
│   ├── not-found.tsx           # Global 404 page
│   ├── layout.tsx              # Root layout (ThemeProvider + NextTopLoader + Toaster)
│   └── manifest.ts, robots.ts, sitemap.ts, opengraph-image.tsx
├── components/                 # App-level shared components
│   ├── app-sidebar.tsx         # Main navigation sidebar (mounts ProfileManagementDialog)
│   ├── sidebar-user-button.tsx # User menu in sidebar
│   ├── sidebar-theme-toggle.tsx # Theme toggle in sidebar
│   ├── header.tsx              # SidebarTrigger + SocketStatus + UserButton (no breadcrumb)
│   ├── theme-toggle.tsx        # Theme toggle button
│   ├── logo.tsx                # App logo component
│   ├── admin-gate.tsx          # Client guard: loader → access denied → 3s auto-redirect to /dashboard
│   ├── socket-status.tsx       # Realtime connection indicator (clickable to reconnect)
│   ├── impersonation-banner.tsx # Banner when admin is impersonating a user (calls authClient.admin.stopImpersonating)
│   ├── full-screen-loader.tsx  # Full-page loading spinner with label
│   ├── realtime-invalidation.tsx # Renderless component that activates socket→query bridge
│   └── user-button.tsx         # User avatar (props: showName, showEmail, side)
├── features/                   # Feature modules (see Feature Module Pattern)
│   └── auth/                   # Profile, 2FA, sessions, password, delete account
├── hooks/                      # App-wide hooks
│   ├── use-user-role.ts        # Current user's global role + hasRole() + userId
│   ├── use-date-locale.ts      # Locale-aware date formatting
│   ├── use-online-users.ts     # Set<userId> of currently online users (via Socket.io presence)
│   └── use-realtime-invalidation.ts # Socket.io → React Query bridge
├── providers/                  # React context providers
│   ├── modal-provider.tsx      # Global dialog registry (LazyMount pattern, currently empty template)
│   ├── query-provider.tsx      # React Query client (staleTime: 60s) + ReactQueryDevtools
│   ├── socket-provider.tsx     # Socket.io lifecycle + token-based auth (exposes useSocket hook)
│   └── theme-provider.tsx      # next-themes (defaultTheme: 'light', enableSystem: false)
├── lib/                        # Singletons and helpers
│   ├── api-client.ts           # @workspace/api-client config (baseUrl: NEXT_PUBLIC_API_URL, credentials: 'include')
│   ├── auth-client.ts          # Better Auth client (plugins: admin, 2FA, emailOTP, inferAdditionalFields)
│   ├── auth-server.ts          # Server-side getServerSession() + isAuthenticated()
│   ├── get-user-avatar.ts      # Gravatar URL helper
│   └── invalidate-by-tags.ts   # invalidateByTags(queryClient, tags) — manual cache invalidation
├── config/
│   └── env.ts                  # Typed env validation (@t3-oss/env-nextjs + zod)
└── next.config.ts              # standalone output, transpilePackages, image config
```

## Route Conventions

### Page structure

Each route follows the pattern:
```
app/(protected)/(group)/feature/
├── page.tsx              # Server component (metadata + renders Client)
└── _components/
    ├── client.tsx        # Main 'use client' component (manages URL state via nuqs inline)
    ├── *-search.tsx      # Filter/search bar
    ├── create-*-dialog.tsx
    └── *-table.tsx
```

- `_components/` is colocated with each route (prefixed with `_` to exclude from routing).
- `client.tsx` is the primary client component rendered by `page.tsx` — handles URL state (search/pagination/filters) inline via `useQueryState` from `nuqs`.
- Shared feature logic goes in `features/` modules. **Route-level `_hooks/` directories are not used today** — current routes keep state in `client.tsx`. Reach for a `_hooks/` folder only if a single route grows enough to need it.

### Route groups

| Group | Path prefix | Purpose |
|-------|-------------|---------|
| `(general)` | `/dashboard` | Welcome dashboard (placeholder cards) |
| `admin` | `/admin`, `/admin/users` | Global admin (no route group) |

### Protected layout

`app/(protected)/layout.tsx` is a server component that:
1. Calls `getServerSession()` (forwards cookies to API via `lib/auth-server.ts`)
2. Redirects to `/api/clear-session` (clears cookies + redirects to `/sign-in`) if unauthenticated
3. Redirects to `/not-authorized` if `session.role === 'user'`
4. Wraps content in provider stack (see Provider Stack below)
5. Persists sidebar open/close state via `sidebar_state` cookie

### Admin layout

`app/(protected)/admin/layout.tsx` is a **client** layout wrapping children in `<AdminGate>`, which:
- Shows a full-screen "access denied" with 3s auto-redirect to `/dashboard` for non-admins
- Uses `useUserRole()` for client-side role check

## Feature Module Pattern

Feature modules in `features/` follow this structure:

```
features/<domain>/
├── index.ts          # Barrel exports (components, hooks, api)
├── schemas.ts        # Zod schemas for forms
├── components/
│   ├── index.ts
│   └── *.tsx         # Feature-specific components
├── hooks/
│   ├── index.ts
│   └── use-*.ts      # Dialog/modal state hooks (zustand)
└── api/              # API wrappers (auth feature uses authClient actions)
    ├── mutations/
    └── query/
```

Currently, only the `auth` feature module exists (profile, 2FA, sessions, password management, delete account). New domain features should follow this same structure.

## Global Modal Provider

App-level dialogs are registered globally in `providers/modal-provider.tsx` and mounted once in the protected layout. Each dialog is lazy-loaded via `next/dynamic` with `ssr: false`.

The modal provider is currently empty and serves as a template. To add a new dialog:

1. Create a zustand hook for the dialog state (e.g., `useMyDialog`)
2. Create the dialog component
3. Register it in `modal-provider.tsx` using the `LazyMount` pattern:

```tsx
<LazyMount useStore={useMyDialog}>
  <MyDialog />
</LazyMount>
```

**Default rule:** mount dialogs in `ModalProvider` and open them via their zustand hook.

**Exception:** `ProfileManagementDialog` is mounted directly in `components/app-sidebar.tsx` (not in `ModalProvider`) because it's tightly coupled to the sidebar user menu. Use the same approach only when a dialog is genuinely scoped to a single component tree.

## Data Fetching

### API Client (`@workspace/api-client`)

The app uses `@workspace/api-client` (generated from OpenAPI spec via `@hey-api/openapi-ts`) for all REST API calls. It is initialized in `lib/api-client.ts` with:

```typescript
import { client } from '@workspace/api-client/client'
client.setConfig({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
})
```

Requests go directly to the API at `NEXT_PUBLIC_API_URL` with `credentials: 'include'`, so HttpOnly session cookies are sent on every request. CORS on the API allows the configured origins (see `apps/api/src/lib/cors.ts` + `TRUSTED_ORIGINS`).

Query keys are structured as `[{ _id: 'operationName', baseUrl, ...params }]`.

### React Query defaults

Configured in `providers/query-provider.tsx`:
- `staleTime: 60_000` (1 minute)
- `refetchOnWindowFocus: false`
- `refetchOnMount: true`, `refetchOnReconnect: true`
- `placeholderData: keepPreviousData`
- `retry: 1`

### Realtime updates (Socket.io)

The backend emits `entity:mutated` Socket.io events after mutations. The frontend listens and invalidates React Query caches automatically.

**Architecture:**
- `providers/socket-provider.tsx` — Manages socket lifecycle, token-based auth (fetches token from `/api/socket-token`)
- `hooks/use-realtime-invalidation.ts` — Tag-based invalidation: matches `invalidateTags` from socket events against `tags` in hey-api query keys
- `lib/invalidate-by-tags.ts` — `invalidateByTags(queryClient, tags)` helper for manual invalidation (same mechanism as realtime)
- `components/realtime-invalidation.tsx` — Renderless component that activates the hook
- `components/socket-status.tsx` — Visual indicator (green/yellow/red dot); clickable to reconnect when disconnected

**Socket auth flow:** The session cookie is HttpOnly, so Socket.io can't access it directly. Instead, the provider fetches a token from `/api/socket-token` (a Next.js API route that reads the cookie server-side) and passes it via `auth: { token }` in the handshake.

**Tag-based invalidation:** Query keys from `@hey-api/openapi-ts` are structured as `[{ _id: 'operationName', tags: ['SwaggerTag'], ... }]`. Both realtime and manual invalidation match against these `tags` using a predicate. The backend defines `ENTITY_INVALIDATION_TAGS` in `lib/realtime-events.ts` mapping entity types to Swagger tags.

**Manual invalidation in feature components:**
```typescript
import { invalidateByTags } from '@/lib/invalidate-by-tags'

// After a mutation's onSuccess:
invalidateByTags(queryClient, ['Users'])
```

When adding new API operations that should auto-refresh, ensure the route's Swagger `tags` match the tags used in `ENTITY_INVALIDATION_TAGS`.

## Authentication

Uses [Better Auth](https://www.better-auth.com/) with the API hosted on the Fastify backend.

**Client:** `lib/auth-client.ts` — `createAuthClient` with plugins: `adminClient` (configured with `ac, admin, user` from `@workspace/shared/permissions`), `twoFactorClient`, `emailOTPClient`, `inferAdditionalFields` (adds `phone` field)

**Server:** `lib/auth-server.ts` — exports two functions:
- `getServerSession()` — fetches session from API via cookie forwarding, returns user object or null
- `isAuthenticated()` — returns boolean, calls getServerSession()

**Plugins:**
- `adminClient` — Global admin role management (with custom permissions from `@workspace/shared/permissions`)
- `twoFactorClient` — TOTP authenticator support
- `emailOTPClient` — Email-delivered OTP codes
- `inferAdditionalFields` — adds `phone: string | null` to the User type

**Impersonation:** `authClient.admin.impersonateUser({ userId })` is supported. When a session has `session.session.impersonatedBy`, the global `<ImpersonationBanner>` shows a warning and a "Stop impersonating" button.

**Auth hooks (via `authClient`):**
```typescript
const { data: session } = authClient.useSession()
```

**Session clearing:** `GET /api/clear-session` clears the session cookies (`SESSION_COOKIE` / `SECURE_SESSION_COOKIE` from `@workspace/shared/auth-cookie` — `turboreposaasstarter.session_token` and its `__Secure-` variant), then redirects to `/sign-in`. Used by the protected layout when session is missing/expired. Honors `NEXT_PUBLIC_COOKIE_DOMAIN` so the cookie is invalidated with the correct scope in cross-subdomain deploys.

## User Roles (Global)

Each user has a single global role stored in `user.role` (via Better Auth admin plugin). Default role for new users: `user`.

| Role | Key | Access |
|------|-----|--------|
| Admin | `admin` | Full access |
| User | `user` | No panel access (redirected to `/not-authorized`) |

**Role hook:**
```typescript
// useUserRole — the only role hook (useOrgRole does not exist)
const { role, userId, isPending, hasRole } = useUserRole()
if (hasRole('admin')) { ... }
```

`useUserRole()` uses `useSyncExternalStore` to prevent hydration mismatches — always returns `null`/`isPending=true` on the server, resolves to actual role on the client.

## Provider Stack

Split across two layouts:

**Root layout** (`app/layout.tsx`):
```
ThemeProvider (wraps entire app) + TopLoader
```

**Protected layout** (`app/(protected)/layout.tsx`), outermost to innermost:
```
QueryProvider → SocketProvider → RealtimeInvalidation → TooltipProvider → ModalProvider → NuqsAdapter → SidebarProvider
```

## Hooks

### App-wide (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useUserRole()` | Returns `{ role, userId, isPending, hasRole }` for current user's global role |
| `useDateLocale()` | Locale-aware date formatting |
| `useOnlineUsers()` | Returns `Set<userId>` of online users via Socket.io presence events |
| `useRealtimeInvalidation()` | Socket.io event → React Query invalidation (used internally by `RealtimeInvalidation`) |

### Feature hooks (`features/auth/hooks/`)

Dialog/modal state hooks using zustand stores:
```typescript
const { isOpen, onOpen, onClose } = useProfileModal()
```

### Route hooks (`app/*/_hooks/`)

Colocated with routes for page-specific state:
```typescript
const { isOpen, onOpen, onClose } = useCreateSomething()
```

## Imports

```typescript
// App aliases
import { env } from '@/config/env'
import { authClient } from '@/lib/auth-client'
import { useUserRole } from '@/hooks'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

// Workspace packages
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { ROLES, ROLE_LABELS } from '@workspace/shared/roles'

// API client (generated from OpenAPI)
import { client } from '@workspace/api-client/client'
import { listUsers } from '@workspace/api-client/sdk'
import { listUsersOptions } from '@workspace/api-client/react-query'
```

Path aliases:
- `@/*` — app root (`apps/dashboard/`)
- `@workspace/ui/*` — UI package
- `@workspace/shared/*` — Shared constants (roles, permissions, auth-cookie)
- `@workspace/api-client/*` — Generated API client

## Environment Variables

See `config/env.ts` for all variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (e.g., `http://localhost:3333`) |
| `NEXT_PUBLIC_BASE_URL` | Yes | App base URL (e.g., `http://localhost:3001`) |
| `APP_NAME` | No | Server-side app name (default: `web`) |
| `NEXT_PUBLIC_APP_NAME` | No | App display name (default: `SaaS App`) |
| `NEXT_PUBLIC_APP_DESCRIPTION` | No | App description (default: `Full-stack SaaS starter template`) |
| `NEXT_PUBLIC_APP_KEYWORDS` | No | SEO keywords (comma-separated) |
| `NEXT_PUBLIC_APP_CREATOR` | No | Creator/author name for metadata |
| `NEXT_PUBLIC_COMPANY_NAME` | No | Company name for branding |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | No | Shared cookie domain (e.g., `.example.com`) for multi-subdomain deploys |
| `NEXT_PUBLIC_INDEXABLE` | No | SEO indexing toggle (default: `false`) |
| `NEXT_PUBLIC_GOOGLE_VERIFICATION` | No | Google Search Console verification |
| `NEXT_PUBLIC_BING_VERIFICATION` | No | Bing Webmaster verification |

## Cross-origin Auth

The dashboard talks to the API directly — no `next.config.ts` rewrites. All HTTP requests use `credentials: 'include'` so HttpOnly session cookies are sent across origins.

| Concern | Setup |
|---------|-------|
| Auth (Better Auth) | `auth-client.ts` with `baseURL: env.NEXT_PUBLIC_API_URL` |
| REST API | `api-client.ts` with `baseUrl: env.NEXT_PUBLIC_API_URL` + `credentials: 'include'` |
| Server-side session | `auth-server.ts` forwards the incoming `cookie` header to `${NEXT_PUBLIC_API_URL}/api/auth/get-session` |
| Socket.io | Direct connection to `NEXT_PUBLIC_API_URL`; token fetched from `/api/socket-token` (HttpOnly cookies can't be read from browser JS) |
| CORS | API allows origins from `lib/cors.ts` + `TRUSTED_ORIGINS` with `credentials: true` |

For deployments where the dashboard and API live on different subdomains of the same parent domain (e.g., `app.example.com` + `api.example.com`):

- Set `COOKIE_DOMAIN=".example.com"` on the API → enables Better Auth `crossSubDomainCookies` so cookies are scoped to the shared parent.
- Set `NEXT_PUBLIC_COOKIE_DOMAIN=".example.com"` on the dashboard → `/api/clear-session` uses it to invalidate the cookie with the correct scope.

In dev both run on `localhost`, so neither var is required.

## UI/UX Conventions

### Touch-friendly hover interactions

For interactive elements that should be hidden on desktop (hover-capable devices) but always visible on touch devices (phones, tablets of any size), use `@media (hover: hover)` instead of responsive breakpoints like `md:`. This detects device capability, not screen size.

```tsx
// Correct — detects hover capability
className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"

// Incorrect — large tablets with touch would hide buttons
className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state management |
| `@tanstack/react-table` | Data tables (admin users) |
| `better-auth` | Authentication client |
| `socket.io-client` | Realtime updates |
| `nuqs` | URL state management (filters, pagination) |
| `zustand` | Client state (dialog/modal stores) |
| `zod` v4 | Schema validation (forms) |
| `framer-motion` | Animations |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |
| `next-themes` | Dark mode |
| `qrcode.react` | QR code display (2FA setup) |
| `ua-parser-js` | User agent parsing (session management) |
| `nextjs-toploader` | Top progress bar on navigation |
