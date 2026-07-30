# packages/

Shared packages for the turborepo-saas-starter monorepo. Each package has its own `CLAUDE.md` with detailed documentation.

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `ui/` | `@workspace/ui` | Shared React component library (shadcn/ui) |
| `api-client/` | `@workspace/api-client` | Auto-generated OpenAPI client |
| `shared/` | `@workspace/shared` | Browser-safe shared constants (roles, permissions, auth cookie names) |
| `eslint-config/` | `@workspace/eslint-config` | Shared ESLint configurations |
| `typescript-config/` | `@workspace/typescript-config` | Shared TypeScript configurations |

> **Detailed documentation:**
> - API: `apps/api/CLAUDE.md`
> - UI: `packages/ui/CLAUDE.md`

---

## @workspace/ui

React component library based on shadcn/ui. Exports source files directly (no build step).

### Imports

```typescript
import { Button, Card, Input } from '@workspace/ui/components'
import { Button } from '@workspace/ui/components/button'     // individual component
import { cn } from '@workspace/ui/lib/utils'
import { useIsMobile } from '@workspace/ui/hooks/use-mobile'
import '@workspace/ui/globals.css'                           // in root layout
```

### Custom input components

```typescript
import { CurrencyInput } from '@workspace/ui/components/currency-input'
import { PhoneInput } from '@workspace/ui/components/phone-input'
import { PasswordInput } from '@workspace/ui/components/password-input'    // toggle show/hide
```

### Form layout components

```typescript
import { FieldGroup, Field, FieldLabel, FieldContent, FieldDescription } from '@workspace/ui/components/field'
// Orientations: vertical (default) | horizontal | responsive

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@workspace/ui/components/empty'
```

### Adding shadcn components

```bash
# Always from the monorepo root
pnpm dlx shadcn@latest add <component> --cwd packages/ui
# After adding, export in: packages/ui/src/components/index.ts
```

### Component conventions

- **CVA** (`class-variance-authority`) for style variants
- **`React.forwardRef`** required for input components
- **`data-slot`** attribute on root elements for CSS targeting
- **`cn()`** always for concatenating Tailwind classes (avoids conflicts)

---

## @workspace/api-client

TypeScript client auto-generated from the API's OpenAPI spec. **Never edit generated files.**

### Regenerate after API changes

```bash
pnpm generate:api    # from the monorepo root
# or
pnpm generate        # inside packages/api-client/
```

> Requires the API running at `http://localhost:3333`

### Imports

```typescript
// SDK functions (direct calls)
import { listUsers, listMembers } from '@workspace/api-client/sdk'

// React Query (query keys + options with invalidation tags)
import { listUsersOptions, listMembersOptions } from '@workspace/api-client/react-query'

// TypeScript types
import type { ListUsersResponse } from '@workspace/api-client/types'
```

### Available operations

**Users:** `listUsers` (paginated list with extended fields)

**Members:** `listMembers` (list team members)

**Health:** `getHealth`, `getHealthLive`, `getHealthReady`

### React Query with tags

Generated query keys include `tags` for tag-based invalidation (same mechanism as Socket.io):

```typescript
// Query key: [{ _id: 'listUsers', tags: ['Users'], ... }]
const options = listUsersOptions({ query: { page: 1, limit: 20 } })
useQuery(options)

// Manual invalidation
import { invalidateByTags } from '@/lib/invalidate-by-tags'
invalidateByTags(queryClient, ['Users'])
```

---

## @workspace/eslint-config

Shared ESLint configurations. Uses ESLint v9 (flat config).

### Available configs

| Export | Usage |
|--------|-------|
| `@workspace/eslint-config/next-js` | Next.js apps |
| `@workspace/eslint-config/react-internal` | React packages (e.g., `packages/ui`) |
| `@workspace/eslint-config/base` | Pure Node.js (e.g., `apps/api`) |

### Usage

```javascript
// apps/web/eslint.config.js
import { nextJsConfig } from '@workspace/eslint-config/next-js'
export default nextJsConfig

// packages/ui/eslint.config.js
import { config } from '@workspace/eslint-config/react-internal'
export default config

// apps/api/eslint.config.js
import { config } from '@workspace/eslint-config/base'
export default config
```

### What each config includes

- **base:** ESLint recommended + TypeScript ESLint + Prettier compat + Turbo plugin + `eslint-plugin-only-warn` (errors become warnings)
- **next-js:** base + React + React Hooks + `@next/eslint-plugin-next` (core-web-vitals)
- **react-internal:** base + React + React Hooks (without Next.js)

---

## @workspace/typescript-config

Base TypeScript configurations. Referenced via `extends` in `tsconfig.json`.

### Available configs

| File | Usage |
|------|-------|
| `nextjs.json` | Next.js apps (`apps/web`) |
| `react-library.json` | React packages (`packages/ui`) |
| `base.json` | Pure Node.js/ESM (`packages/api`, `packages/api-client`) |

### Usage

```json
// apps/web/tsconfig.json
{
  "extends": "@workspace/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}

// packages/ui/tsconfig.json
{
  "extends": "@workspace/typescript-config/react-library.json"
}

// apps/api/tsconfig.json (and api-client)
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Key differences between configs

| Setting | `base.json` | `nextjs.json` | `react-library.json` |
|---------|------------|---------------|----------------------|
| `module` | `NodeNext` | `ESNext` | `NodeNext` |
| `moduleResolution` | `NodeNext` | `Bundler` | `NodeNext` |
| `jsx` | -- | `preserve` | `react-jsx` |
| `noEmit` | `false` | `true` | `false` |

- **`base`**: Strict ESM for Node.js (requires `.js` extensions in imports)
- **`nextjs`**: Bundler resolution, Next.js handles the build
- **`react-library`**: React 17+ JSX transform (no `import React`)
- All use `strict: true` and `noUncheckedIndexedAccess: true`
