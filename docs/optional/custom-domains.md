# Custom Domains — Notas Arquiteturais

Documento de referência para quando a feature de **custom domains por tenant** for implementada (cliente aponta seu próprio domínio para a aplicação, ex: `app.cliente.com.br`).

> Status atual: **não implementado**. A topologia de produção hoje é cross-subdomain de subdomínios oficiais (ex: `*.zyazgb.easypanel.host`) com `COOKIE_DOMAIN` compartilhado. Veja `apps/api/.env.example`.

---

## Por que "permitir qualquer origin" é perigoso

Refletir qualquer `Origin` no header CORS com `credentials: true` (ou setar `trustedOrigins: ['*']` no Better Auth) abre vetores graves:

1. **CSRF amplificado em endpoints autenticados** — qualquer site malicioso pode chamar a API com cookies do usuário e **ler a resposta** (porque o servidor refletiu o origin no `Allow-Origin`).
2. **Sign-in via origin malicioso** — Better Auth aceita `sign-in/email` se o origin estiver em `trustedOrigins`. Página de phishing dispara login real e captura sessão.
3. **Account takeover via OAuth/magic-link callback** — `redirectTo` é validado contra `trustedOrigins`. Permissivo = atacante redireciona o token para domínio próprio.
4. **Bypass do CSRF protection do Better Auth** — a defesa CSRF é exatamente o `Origin/Referer check` contra `trustedOrigins`. Liberar = remover a defesa.
5. **Subdomain takeover** (na topologia atual com `COOKIE_DOMAIN` compartilhado) — atacante registra `evil.zyazgb.easypanel.host` e captura cookies de todos os tenants.

> O spec do CORS proíbe `Allow-Origin: *` com `Allow-Credentials: true` (browser rejeita). Por isso "qualquer domínio" na prática é sempre **reflexão de origin**, e essa reflexão é o que cria o problema acima.

---

## Solução A — Whitelist dinâmica via banco

Para casos pontuais (custom domain como upsell pra poucos clientes enterprise) sem mudar a infra.

### Modelo

```prisma
model TenantDomain {
  id           String   @id @default(cuid())
  tenantId     String
  domain       String   @unique          // "app.cliente.com.br"
  verified     Boolean  @default(false)
  verifyToken  String                    // valor esperado no DNS TXT
  verifiedAt   DateTime?
  createdAt    DateTime @default(now())
  @@index([domain, verified])
}
```

Tenant cadastra → você obriga **verificação de ownership** (DNS TXT ou HTTP-01) → marca `verified=true` → só então o domínio entra na whitelist.

### Fastify CORS (função async + cache)

```ts
const isCustomDomainAllowed = async (origin: string) => {
  const host = new URL(origin).hostname
  const cached = await cache.get<boolean>(`domain:${host}`)
  if (cached !== null) return cached
  const found = await prisma.tenantDomain.findFirst({
    where: { domain: host, verified: true },
    select: { id: true },
  })
  const ok = !!found
  await cache.set(`domain:${host}`, ok, 300)
  return ok
}

await app.register(cors, {
  origin: async (origin, cb) => {
    if (!origin) return cb(null, false)
    if (isAllowedOrigin(origin)) return cb(null, true)
    return cb(null, await isCustomDomainAllowed(origin))
  },
  credentials: true,
})
```

### Better Auth `trustedOrigins` async

```ts
trustedOrigins: async (request) => {
  const origin = request.headers.get('origin')
  if (!origin) return env.TRUSTED_ORIGINS
  if (env.TRUSTED_ORIGINS.includes(origin)) return env.TRUSTED_ORIGINS
  const ok = await isCustomDomainAllowed(origin)
  return ok ? [...env.TRUSTED_ORIGINS, origin] : env.TRUSTED_ORIGINS
}
```

Invalide o cache (`cache.del('domain:...')`) no add/update/delete do domínio.

### Caveat de cookie

Custom domain (`app.cliente.com.br`) e API (`api.suaapp.com`) são **cross-site** (eTLD+1 diferente). Implicações:

- `sameSite: 'lax'` **não envia cookie** em request cross-site → login não funciona
- Precisa `sameSite: 'none'; secure; partitioned` (CHIPS) → cada custom domain tem sessão **particionada e isolada**
- `crossSubDomainCookies` / `COOKIE_DOMAIN` **não se aplica** a custom domains
- Coexistir `lax` + cross-subdomain (oficial) com `none + partitioned` (custom) é difícil — Better Auth força uma postura global

---

## Solução B — Proxy de path no mesmo origin (recomendada se a feature é core)

Cliente aponta `app.cliente.com.br` (CNAME) para um proxy seu que serve **dashboard + API no mesmo origin**:

- `app.cliente.com.br/*` → dashboard
- `app.cliente.com.br/api/*` → API
- `app.cliente.com.br/socket.io/*` → API (com upgrade WS)

Same origin → CORS desligado, sem `sameSite: 'none'`, sem CHIPS, sem reflexão de origin. Cookies escopados ao próprio host. Cada custom domain isolado naturalmente. É como Vercel/Netlify/Cloudflare Pages fazem multi-tenant.

### Estrutura sugerida

```
apps/
  proxy/          # ← novo
    Caddyfile
    Dockerfile
  dashboard/
packages/
  api/
```

### Caddy (recomendado — sem código próprio)

```caddyfile
{
  on_demand_tls {
    ask https://api.internal/internal/check-domain
  }
}

https:// {
  tls {
    on_demand
  }
  @api path /api/* /socket.io/*
  reverse_proxy @api api:3333
  reverse_proxy dashboard:3000
}
```

### Endpoint de validação `/internal/check-domain`

Caddy chama esse endpoint **antes de emitir cert ACME** para um host novo. Sem isso, atacante esgota rate limit do Let's Encrypt (50 certs/dia/account).

```ts
app.get('/internal/check-domain', async (request, reply) => {
  const domain = request.query.domain
  const ok = await prisma.tenantDomain.findFirst({
    where: { domain, verified: true },
  })
  return ok ? reply.code(200).send() : reply.code(404).send()
})
```

Proteja esse endpoint (IP allowlist do Caddy ou shared secret).

### Alternativa: Fastify proxy

Se quiser controle programático (logging por tenant, header rewrites complexos):

```ts
import Fastify from 'fastify'
import httpProxy from '@fastify/http-proxy'

const app = Fastify({ logger: true, trustProxy: true })

await app.register(httpProxy, { upstream: 'http://api:3333', prefix: '/api' })
await app.register(httpProxy, { upstream: 'http://api:3333', prefix: '/socket.io', websocket: true })
await app.register(httpProxy, { upstream: 'http://dashboard:3000', prefix: '/' })

await app.listen({ host: '0.0.0.0', port: 8080 })
```

TLS você delega para Caddy/Traefik na frente. Mais código, mais coisa pra manter — só vale se precisar de lógica programática real.

---

## Pontos de atenção (Solução B)

### 1. `BETTER_AUTH_URL` em multi-tenant

Hoje é fixa. Com custom domains, links de email precisam apontar para o domínio do tenant.

Duas saídas:

- **Mais simples**: emails apontam para domínio oficial; handler de `/verify` redireciona para o tenant via query param (`?return_to=https://app.cliente.com.br/...`).
- **Mais correto**: interceptar `sendVerificationEmail` / `sendResetPassword` e reescrever `url` substituindo o host pelo do tenant, lido de `request.headers['x-forwarded-host']` (injetado pelo proxy).

### 2. Dashboard fala com API por path relativo

Hoje usa `NEXT_PUBLIC_API_URL` absoluto. Atrás do proxy:
- `NEXT_PUBLIC_API_URL=""` (vazio = relativo) ou `/api` como base
- `auth-server.ts` (server-side, dentro do container) precisa de URL absoluto interno → nova var `INTERNAL_API_URL=http://api:3333`

### 3. Domínio oficial também deve ir pelo proxy

Não vale manter `*.zyazgb.easypanel.host` na arquitetura cross-subdomain antiga **e** custom domains atrás do proxy. Duas topologias coexistindo = bug certo. Migrar tudo ou nada.

### 4. Headers a propagar

`X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`. Caddy faz por default; Fastify proxy precisa configurar. A API já lê `X-Forwarded-For` (rate limit) e `X-Forwarded-Host` (`/api/clear-session`).

### 5. WebSocket

Socket.io faz upgrade em `/socket.io/`. Caddy proxia WS automaticamente em `reverse_proxy`. Em Fastify proxy use `websocket: true`.

### 6. Bull Board e Swagger

`/docs` e `/admin/queues` ficam expostos em **todos** os domínios (oficial + custom). Provavelmente:
- Bull Board: bloqueado no proxy exceto via VPN/IP allowlist
- Swagger: só no domínio oficial, ou só em dev

### 7. On-demand TLS abuse

Sem `ask` callback, atacante pode pedir cert pra qualquer host random e drenar rate limit do Let's Encrypt. **Sempre** configure o `ask` apontando pro endpoint de validação.

---

## Impacto na config atual (se for Solução B)

| Arquivo | Mudança |
|---|---|
| `apps/api/src/lib/cors.ts` | Pode virtualmente sumir (mesmo origin = sem CORS) |
| `apps/api/src/lib/auth.ts` | Remove `crossSubDomainCookies`. Mantém `sameSite: 'lax'`, `useSecureCookies: prod` |
| `apps/api/src/plugins/auth.ts` | Remove CORS manual em `/api/auth/*` |
| `apps/api/src/lib/socket.ts` | CORS pode virar `origin: false` (mesmo origin sempre) |
| `apps/dashboard/lib/auth-client.ts` | `baseURL: '/api'` ou string vazia |
| `apps/dashboard/lib/api-client.ts` | `baseUrl: '/api'`, mantém `credentials: 'include'` |
| `apps/dashboard/lib/auth-server.ts` | Usa `INTERNAL_API_URL` (host interno do container) |
| `apps/dashboard/app/api/socket-token/route.ts` | Pode sumir — Socket.io herda cookie via `withCredentials: true` (mesmo host) |
| `apps/dashboard/app/api/clear-session/route.ts` | Remove uso de `NEXT_PUBLIC_COOKIE_DOMAIN` |
| `.env.example` (API) | Remove `COOKIE_DOMAIN`, `TRUSTED_ORIGINS`. Adiciona/ajusta `BETTER_AUTH_URL` para o host externo do proxy. |
| `.env.example` (dashboard) | Remove `NEXT_PUBLIC_COOKIE_DOMAIN`. Ajusta `NEXT_PUBLIC_API_URL=""`. Adiciona `INTERNAL_API_URL`. |

---

## Decisão recomendada

| Caso | Solução |
|---|---|
| Custom domain é **feature core** do produto | **B (proxy + Caddy)** — vale o investimento de infra |
| Custom domain é **upsell pra poucos clientes enterprise** | **A (whitelist dinâmica + CHIPS)** — menos infra, mais código |
| Não precisa de custom domain | Manter topologia atual (cross-subdomain via `COOKIE_DOMAIN`) |

---

## Referências

- [Better Auth — `trustedOrigins` (function form)](https://www.better-auth.com/docs/concepts/cookies)
- [Better Auth — `crossSubDomainCookies`](https://www.better-auth.com/docs/concepts/cookies#cross-subdomain-cookies)
- [CHIPS (Cookies Having Independent Partitioned State)](https://developers.google.com/privacy-sandbox/cookies/chips)
- [Caddy on-demand TLS](https://caddyserver.com/docs/automatic-https#on-demand-tls)
- [Public Suffix List](https://publicsuffix.org/) — verificar se domínio pai está listado antes de assumir que `COOKIE_DOMAIN=.parent.com` funciona
