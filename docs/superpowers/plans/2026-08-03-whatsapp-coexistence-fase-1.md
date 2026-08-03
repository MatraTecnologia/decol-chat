# WhatsApp Coexistence — Fase 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o número da empresa à Cloud API via Embedded Signup sem tirá-lo do celular, e deixar o webhook despachando por `changes[].field` com log verbatim dos eventos ainda não parseados.

**Architecture:** O onboarding manual (`credentials-form` → `upsertConnection` → `registerPhoneNumber`) é substituído pelo Embedded Signup: o front obtém um `code`, a API troca por token, grava cifrado e **não** registra o número. `appSecret` e `verifyToken` deixam de ser colunas e passam a vir do env, porque sob ES são do app e não da conta. O `lib/whatsapp/inbound.ts` vira o diretório `lib/whatsapp/inbound/`, com um router que despacha por `changes[].field` e resolve a conta em cascata (`value.metadata.phone_number_id` → `entry[].id`).

**Tech Stack:** Fastify 5 + `fastify-type-provider-zod`, Prisma 7, BullMQ, Next.js 16 + React Query, Facebook JS SDK (`FB.login`), `node:test` com type stripping nativo.

## Escopo deste plano

**Só a Fase 1 da spec** ([`2026-08-03-whatsapp-coexistence-design.md`](../specs/2026-08-03-whatsapp-coexistence-design.md)).

As Fases 2 e 3 (parsers de `smb_message_echoes`, `smb_app_state_sync`, `history` e o backfill) **não entram**, e isso é deliberado: a spec estabelece que os nomes de campo saem de payload observado, não de documentação de terceiro. A Fase 1 é justamente o que produz esses payloads — ela conecta o número, faz os eventos chegarem e os registra verbatim. Escrever agora os parsers seria adivinhar o formato e é o erro que a spec existe para evitar.

Ao fim deste plano: o número funciona conectado no celular e na API, mensagens recebidas continuam entrando normalmente, e os três eventos novos aparecem no console de `/conexao` com o corpo cru. O plano da Fase 2 é escrito com esses payloads em mãos.

## Global Constraints

- `const` arrow functions sempre — nunca `function` declarations.
- Todos os imports com extensão `.js` (ESM, `"type": "module"`).
- Path alias `@/*` → `src/*` para imports cross-directory; `./` para o mesmo diretório.
- Toda rota precisa de `schema` com `tags` e `summary`; body/params/querystring em Zod.
- Erros locale-aware: `reply.notFound(request.t('NOT_FOUND'))`.
- Envs de WhatsApp são **opcionais** no schema (`.optional()`) — a API precisa subir em ambiente que não usa WhatsApp, padrão já estabelecido por `WHATSAPP_ENCRYPTION_KEY`.
- Testes: `.test.mjs` colocado ao lado do arquivo, `node:test` + `node:assert/strict`, importando o `.ts` diretamente.
- Sem comentários explicativos em código não modificado; sem `console.log`.
- O webhook responde `200` incondicionalmente depois da assinatura aceita — nunca mudar isso.
- Após qualquer mudança de schema de rota: `pnpm generate:api` **com a API rodando** (`curl -s http://localhost:3333/health` retornando `ok` antes).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/lib/whatsapp/inbound/payload.ts` | Funções puras de extração do envelope da Meta — sem I/O |
| `apps/api/src/lib/whatsapp/inbound/resolve-account.ts` | Resolve `WhatsAppAccount` a partir das refs extraídas |
| `apps/api/src/lib/whatsapp/inbound/shared.ts` | Helpers compartilhados entre handlers (mapeamentos, contato, idempotência) |
| `apps/api/src/lib/whatsapp/inbound/messages.ts` | Handler do field `messages` — código atual, sem mudança de comportamento |
| `apps/api/src/lib/whatsapp/inbound/index.ts` | Router por `field` + reexport de `processInboundPayload` |
| `apps/api/src/lib/whatsapp/oauth.ts` | `exchangeCodeForToken` |
| `apps/api/src/jobs/whatsapp-smb-sync.ts` | Dispara o pedido dos dados do app do celular (janela de 24h) |
| `apps/api/src/routes/whatsapp/embedded-signup.ts` | `POST /whatsapp/connection/embedded-signup` |
| `apps/dashboard/.../conexao/_components/embedded-signup-button.tsx` | Carrega o FB SDK e dispara o fluxo |

---

### Task 1: Envs do Embedded Signup + script de teste

**Files:**
- Modify: `apps/api/src/env.ts:50-54`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json:10-21` (scripts)
- Modify: `apps/dashboard/config/env.ts`
- Modify: `apps/dashboard/.env.example`

**Interfaces:**
- Consumes: nada.
- Produces: `env.META_APP_ID`, `env.META_APP_SECRET`, `env.META_ES_CONFIG_ID`, `env.META_WEBHOOK_VERIFY_TOKEN` (todos `string | undefined`) na API; `env.NEXT_PUBLIC_META_APP_ID`, `env.NEXT_PUBLIC_META_ES_CONFIG_ID` (`string | undefined`) no dashboard. Script `pnpm --filter @workspace/api test`.

- [ ] **Step 1: Adicionar as envs da API**

Em `apps/api/src/env.ts`, dentro do bloco `// WhatsApp Cloud API`, logo abaixo de `PUBLIC_WEBHOOK_BASE_URL`:

```typescript
    // Embedded Signup (Coexistence) — credenciais do app Meta, não da conta.
    // Opcionais pelo mesmo motivo das demais: a API sobe sem WhatsApp.
    META_APP_ID: z.string().trim().min(1).optional(),
    META_APP_SECRET: z.string().trim().min(1).optional(),
    META_ES_CONFIG_ID: z.string().trim().min(1).optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().trim().min(1).optional(),
```

- [ ] **Step 2: Documentar no `.env.example` da API**

Acrescente ao final da seção de WhatsApp em `apps/api/.env.example`:

```bash
# Embedded Signup (Coexistence) — App Dashboard da Meta
META_APP_ID=
META_APP_SECRET=
META_ES_CONFIG_ID=
# Precisa ser igual ao configurado em Webhooks > Verify Token no App Dashboard
META_WEBHOOK_VERIFY_TOKEN=
```

- [ ] **Step 3: Adicionar as envs do dashboard**

Em `apps/dashboard/config/env.ts`, no bloco `client`:

```typescript
    NEXT_PUBLIC_META_APP_ID: z.string().trim().min(1).optional(),
    NEXT_PUBLIC_META_ES_CONFIG_ID: z.string().trim().min(1).optional(),
```

E no bloco `runtimeEnv` do mesmo arquivo (o `@t3-oss/env-nextjs` exige o mapeamento explícito para vars client):

```typescript
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
    NEXT_PUBLIC_META_ES_CONFIG_ID: process.env.NEXT_PUBLIC_META_ES_CONFIG_ID,
```

E em `apps/dashboard/.env.example`:

```bash
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_META_ES_CONFIG_ID=
```

- [ ] **Step 4: Adicionar o script de teste da API**

Em `apps/api/package.json`, em `scripts`, logo depois de `"typecheck"`:

```json
    "test": "node --test src/",
```

Os `.test.mjs` já existentes (`template-payload`, `templates/assets`, `templates/policy`, `routes/whatsapp/templates-policy`) importam `.ts` direto e dependem do type stripping nativo do Node 24 — que o `engines` do pacote já exige.

- [ ] **Step 5: Rodar a suíte existente para provar que o script funciona**

Run: `pnpm --filter @workspace/api test`
Expected: PASS em todos os `.test.mjs` já existentes. Se algum falhar, é regressão pré-existente — pare e reporte antes de seguir.

- [ ] **Step 6: Verificar que a API ainda valida o env**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/env.ts apps/api/.env.example apps/api/package.json apps/dashboard/config/env.ts apps/dashboard/.env.example
git commit -m "feat(whatsapp): envs do Embedded Signup + script de teste da API"
```

---

### Task 2: Extração pura do envelope da Meta

O router precisa saber, para cada `change`, qual é o `field` e quais identificadores de conta o evento carrega. Isso é parsing puro e é onde mora o bug do guard atual — então é a primeira coisa a ganhar teste.

**Files:**
- Create: `apps/api/src/lib/whatsapp/inbound/payload.ts`
- Test: `apps/api/src/lib/whatsapp/inbound/payload.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type MetaChange = { field: string | null; phoneNumberId: string | null; wabaId: string | null; value: unknown }`
  - `extractChanges(payload: unknown): MetaChange[]`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/lib/whatsapp/inbound/payload.test.mjs`:

```javascript
import assert from 'node:assert/strict'
import test from 'node:test'

import { extractChanges } from './payload.ts'

test('extrai field e phone_number_id de um evento de mensagens', () => {
  const [change] = extractChanges({
    entry: [
      {
        id: '111',
        changes: [
          {
            field: 'messages',
            value: { metadata: { phone_number_id: '999' }, messages: [] },
          },
        ],
      },
    ],
  })

  assert.equal(change.field, 'messages')
  assert.equal(change.phoneNumberId, '999')
  assert.equal(change.wabaId, '111')
})

test('evento de echo traz o waba id no entry, sem metadata', () => {
  const [change] = extractChanges({
    entry: [
      {
        id: '111',
        changes: [
          {
            field: 'smb_message_echoes',
            value: { messaging_product: 'whatsapp', message_echoes: [] },
          },
        ],
      },
    ],
  })

  assert.equal(change.field, 'smb_message_echoes')
  assert.equal(change.phoneNumberId, null)
  assert.equal(change.wabaId, '111')
})

test('achata múltiplas entries e changes na ordem recebida', () => {
  const changes = extractChanges({
    entry: [
      { id: 'a', changes: [{ field: 'messages' }, { field: 'history' }] },
      { id: 'b', changes: [{ field: 'smb_app_state_sync' }] },
    ],
  })

  assert.deepEqual(
    changes.map(c => [c.field, c.wabaId]),
    [
      ['messages', 'a'],
      ['history', 'a'],
      ['smb_app_state_sync', 'b'],
    ],
  )
})

test('payload irreconhecível devolve lista vazia em vez de estourar', () => {
  assert.deepEqual(extractChanges(null), [])
  assert.deepEqual(extractChanges(undefined), [])
  assert.deepEqual(extractChanges({}), [])
  assert.deepEqual(extractChanges({ entry: 'nope' }), [])
  assert.deepEqual(extractChanges({ entry: [{}] }), [])
})

test('field ausente vira null em vez de string vazia', () => {
  const [change] = extractChanges({
    entry: [{ id: 'a', changes: [{ value: {} }] }],
  })

  assert.equal(change.field, null)
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm --filter @workspace/api test`
Expected: FAIL — `Cannot find module './payload.ts'`.

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/whatsapp/inbound/payload.ts`:

```typescript
/**
 * Leitura do envelope do webhook da Meta — puro, sem I/O.
 *
 * Tipagem mínima e toda opcional pelo mesmo motivo do resto da ingestão: a
 * Meta acrescenta campos sem aviso e o parsing precisa sobreviver a um
 * formato que não reconhece.
 */

export interface MetaChange {
  field: string | null
  phoneNumberId: string | null
  wabaId: string | null
  value: unknown
}

interface RawChange {
  field?: string
  value?: { metadata?: { phone_number_id?: string } }
}

interface RawEntry {
  id?: string
  changes?: RawChange[]
}

interface RawPayload {
  entry?: RawEntry[]
}

/**
 * Achata `entry[].changes[]` numa lista única.
 *
 * O `wabaId` sai de `entry[].id` porque os eventos de coexistence
 * (`smb_message_echoes`, `smb_app_state_sync`) não trazem `metadata` dentro de
 * `value` — só o `messages` traz. Ler apenas o `phone_number_id` descartaria
 * esses eventos em silêncio.
 */
export const extractChanges = (payload: unknown): MetaChange[] => {
  const entries = (payload as RawPayload | null)?.entry

  if (!Array.isArray(entries)) return []

  return entries.flatMap(entry => {
    const changes = entry?.changes

    if (!Array.isArray(changes)) return []

    return changes.map(change => ({
      field: change?.field ?? null,
      phoneNumberId: change?.value?.metadata?.phone_number_id ?? null,
      wabaId: entry?.id ?? null,
      value: change?.value,
    }))
  })
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm --filter @workspace/api test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/whatsapp/inbound/payload.ts apps/api/src/lib/whatsapp/inbound/payload.test.mjs
git commit -m "feat(whatsapp): extracao pura do envelope do webhook"
```

---

### Task 3: Resolver conta pelo WABA id

**Files:**
- Modify: `apps/api/prisma/schema.prisma:243-269` (model `WhatsAppAccount`)
- Modify: `apps/api/src/lib/whatsapp/connection.ts:81-101`
- Create: `apps/api/src/lib/whatsapp/inbound/resolve-account.ts`

**Interfaces:**
- Consumes: `MetaChange` (Task 2).
- Produces:
  - `getAccountByWabaId(wabaId: string): Promise<DecryptedAccount | null>` em `connection.ts`
  - `resolveAccountForChange(change: MetaChange): Promise<DecryptedAccount | null>`

- [ ] **Step 1: Adicionar o índice em `wabaId`**

Em `apps/api/prisma/schema.prisma`, no model `WhatsAppAccount`, junto dos índices existentes:

```prisma
  @@index([isActive])
  @@index([wabaId])
```

- [ ] **Step 2: Sincronizar o schema**

Run: `pnpm --filter @workspace/api db:push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Adicionar `getAccountByWabaId`**

Em `apps/api/src/lib/whatsapp/connection.ts`, logo depois de `getAccountByPhoneNumberId`:

```typescript
/**
 * Os eventos de coexistence não trazem `phone_number_id` — só o `entry[].id`,
 * que é o WABA. Como a instalação é single-account, a conta ativa daquela WABA
 * é sempre a certa.
 */
export const getAccountByWabaId = async (wabaId: string) => {
  const record = await prisma.whatsAppAccount.findFirst({
    where: { wabaId, isActive: true },
  })

  return record ? decrypt(record) : null
}
```

- [ ] **Step 4: Implementar a cascata**

Crie `apps/api/src/lib/whatsapp/inbound/resolve-account.ts`:

```typescript
import {
  getAccountByPhoneNumberId,
  getAccountByWabaId,
} from '../connection.js'

import type { MetaChange } from './payload.js'

/**
 * O `phone_number_id` é preferido por ser mais específico: identifica o número,
 * não a conta comercial inteira. O WABA é o fallback dos eventos que não o
 * trazem.
 */
export const resolveAccountForChange = async (change: MetaChange) => {
  const byPhone = change.phoneNumberId
    ? await getAccountByPhoneNumberId(change.phoneNumberId)
    : null

  if (byPhone) return byPhone

  return change.wabaId ? await getAccountByWabaId(change.wabaId) : null
}
```

- [ ] **Step 5: Verificar tipos**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/lib/whatsapp/connection.ts apps/api/src/lib/whatsapp/inbound/resolve-account.ts
git commit -m "feat(whatsapp): resolve conta pelo waba id quando nao ha phone_number_id"
```

---

### Task 4: Converter `inbound.ts` no diretório `inbound/` com router

Movimentação de código com uma única mudança de comportamento: o despacho por `field` e o log verbatim do que não tem handler. O caminho de `messages` sai idêntico.

**Files:**
- Create: `apps/api/src/lib/whatsapp/inbound/shared.ts`
- Create: `apps/api/src/lib/whatsapp/inbound/messages.ts`
- Create: `apps/api/src/lib/whatsapp/inbound/index.ts`
- Delete: `apps/api/src/lib/whatsapp/inbound.ts`

**Interfaces:**
- Consumes: `extractChanges` (Task 2), `resolveAccountForChange` (Task 3).
- Produces:
  - `processInboundPayload(app: InboundContext, payload: unknown): Promise<void>` — **mesma assinatura de hoje**, exportada de `inbound/index.ts`.
  - `type InboundContext` (reexportado de `shared.ts`)
  - `handleMessagesChange(app, accountId, value): Promise<void>` em `messages.ts`

Esta task é movimentação de código coberta pelo teste de `extractChanges` (Task 2) e pela verificação da ingestão viva (Step 7) — não introduz teste unitário novo.

- [ ] **Step 1: Extrair `shared.ts`**

Crie `apps/api/src/lib/whatsapp/inbound/shared.ts` movendo, **sem alterar nenhuma linha**, de `apps/api/src/lib/whatsapp/inbound.ts`:

- o `import type { FastifyInstance } from 'fastify'` e os imports de Prisma/prisma/messageSelect/phone
- `export type InboundContext` (linha 24)
- as interfaces `MetaMedia`, `MetaMessage`, `MetaStatus`, `MetaContact` (linhas 31-60) — todas exportadas
- `TYPE_MAP`, `STATUS_MAP`, `LOWER_THAN`, `PREVIEW_LENGTH` (linhas 75-113)
- `mapType`, `mediaOf`, `extractText`, `toWaTimestamp`, `isDuplicateMessage`, `resolveContact` (linhas 117-239)

Ajuste os imports relativos: `./connection.js` vira `../connection.js`, `./phone.js` vira `../phone.js`. O import de `@/routes/conversations/messages.js` e os `@/generated/...` não mudam (são absolutos).

Marque como `export` tudo que `messages.ts` vai consumir: `InboundContext`, `MetaMessage`, `MetaStatus`, `MetaContact`, `PREVIEW_LENGTH`, `mapType`, `mediaOf`, `extractText`, `toWaTimestamp`, `isDuplicateMessage`, `resolveContact`, `STATUS_MAP`, `LOWER_THAN`.

- [ ] **Step 2: Extrair `messages.ts`**

Crie `apps/api/src/lib/whatsapp/inbound/messages.ts` com `applyStatus` (linhas 243-286) e `ingestMessage` (linhas 290-418) **sem alteração de comportamento**, importando o que precisa de `./shared.js`, mais o novo ponto de entrada do handler:

```typescript
interface MessagesValue {
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}

/**
 * Ordem preservada do código anterior: os `statuses` são aplicados antes das
 * mensagens novas, porque um status pode se referir a mensagem já persistida
 * num evento anterior.
 */
export const handleMessagesChange = async (
  app: InboundContext,
  accountId: string,
  value: unknown,
) => {
  const { contacts, messages, statuses } = (value ?? {}) as MessagesValue

  for (const status of statuses ?? []) {
    await applyStatus(app, status)
  }

  for (const message of messages ?? []) {
    await ingestMessage(app, accountId, contacts ?? [], message)
  }
}
```

- [ ] **Step 3: Escrever o router**

Crie `apps/api/src/lib/whatsapp/inbound/index.ts`:

```typescript
/**
 * Ingestão dos eventos que a Meta entrega no webhook.
 *
 * Vive fora de `jobs/` de propósito: o arquivo do job abre a conexão do BullMQ
 * no import, e quem só quer processar um payload (worker, teste) não precisa
 * dela. O worker é uma casca fina em volta de `processInboundPayload`.
 */
import { handleMessagesChange } from './messages.js'
import { extractChanges } from './payload.js'
import { resolveAccountForChange } from './resolve-account.js'
import type { InboundContext } from './shared.js'

export type { InboundContext } from './shared.js'

export const processInboundPayload = async (
  app: InboundContext,
  payload: unknown,
) => {
  for (const change of extractChanges(payload)) {
    const account = await resolveAccountForChange(change)

    // Número que não é desta instalação não é erro retentável.
    if (!account) {
      app.log.warn(
        { field: change.field, wabaId: change.wabaId },
        'Evento do WhatsApp para conta desconhecida — descartado',
      )
      continue
    }

    if (change.field === 'messages') {
      await handleMessagesChange(app, account.id, change.value)
      continue
    }

    // Field sem parser é registrado com o corpo inteiro: é este log que
    // fornece o formato real dos eventos de coexistence para a Fase 2.
    app.log.info(
      { field: change.field, value: change.value },
      'Evento do WhatsApp sem handler — payload registrado para análise',
    )
  }
}
```

- [ ] **Step 4: Apagar o arquivo antigo e corrigir o import do job**

```bash
git rm apps/api/src/lib/whatsapp/inbound.ts
```

ESM com resolução NodeNext **não** tem fallback de índice de diretório — isso é comportamento de CJS. O import atual em `apps/api/src/jobs/whatsapp-inbound.ts:11` deixa de resolver e precisa nomear o arquivo:

```typescript
import { processInboundPayload } from '@/lib/whatsapp/inbound/index.js'
```

Atualize também o comentário do topo do job (linha 6), que aponta para `lib/whatsapp/inbound.ts`, para `lib/whatsapp/inbound/`.

- [ ] **Step 5: Conferir que nada mais importava do arquivo antigo**

Run: `grep -rn "whatsapp/inbound" apps/api/src --include=*.ts`
Expected: só `jobs/whatsapp-inbound.ts` (já apontando para `inbound/index.js`) e os arquivos dentro de `inbound/`. Qualquer specifier terminando em `inbound.js` sem o `/index` ainda é resolução quebrada.

- [ ] **Step 6: Rodar testes e typecheck**

Run: `pnpm --filter @workspace/api test`
Expected: PASS — os testes de `extractChanges` continuam verdes.

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros.

- [ ] **Step 7: [VERIFICAÇÃO HUMANA — não executar] Provar que a ingestão viva não regrediu**

Exige API rodando, túnel ativo e um celular. Fica pendente para o dono do projeto: mandar uma mensagem de WhatsApp para o número conectado e confirmar que ela aparece no inbox e no console de `/conexao`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/whatsapp/inbound/ apps/api/src/lib/whatsapp/inbound.ts apps/api/src/jobs/whatsapp-inbound.ts
git commit -m "refactor(whatsapp): router de webhook por field + log verbatim dos fields sem handler"
```

---

### Task 5: Webhook lê `appSecret` e `verifyToken` do env

**Files:**
- Modify: `apps/api/src/routes/webhooks/whatsapp.ts:117-131` (`safeGetAccount`), `:174-198` (handshake), `:216-258` (assinatura)

**Interfaces:**
- Consumes: `env.META_APP_SECRET`, `env.META_WEBHOOK_VERIFY_TOKEN` (Task 1).
- Produces: nenhuma API nova.

- [ ] **Step 1: Trocar a fonte do verify token no handshake**

Em `apps/api/src/routes/webhooks/whatsapp.ts`, importe o env:

```typescript
import { env } from '@/env.js'
```

E no handler do `GET`, substitua o bloco que lê a conexão (`const connection = await safeGetAccount(app, null)` e o cálculo de `valid`) por:

```typescript
      const expected = env.META_WEBHOOK_VERIFY_TOKEN

      const valid =
        mode === 'subscribe' && Boolean(token) && Boolean(expected) && token === expected
```

O handshake deixa de depender da conta: sob Embedded Signup o verify token é configurado uma vez no App Dashboard, e a assinatura do webhook é revalidada pela Meta em momentos em que ainda pode não haver conta gravada.

- [ ] **Step 2: Trocar a fonte do app secret na verificação de assinatura**

No handler do `POST`, substitua o cálculo de `valid` por:

```typescript
      const appSecret = env.META_APP_SECRET

      const valid =
        Boolean(appSecret) &&
        Boolean(rawBody) &&
        verifySignature(
          rawBody as Buffer,
          headerValue(request, SIGNATURE_HEADER),
          appSecret as string,
        )
```

E ajuste o cálculo de `reason` logo abaixo, trocando o primeiro ramo:

```typescript
        const reason = !appSecret
          ? 'META_APP_SECRET não configurada'
          : !rawBody
            ? 'raw body ausente'
            : !signatureHeader
              ? 'header de assinatura ausente'
              : 'assinatura não confere'
```

- [ ] **Step 3: Remover o que ficou órfão**

`safeGetAccount`, `extractPhoneNumberId` e os imports de `getAccountByPhoneNumberId`/`getConnection` não são mais usados neste arquivo — a resolução de conta agora é responsabilidade do router (Task 4). Apague os três e os imports.

- [ ] **Step 4: Verificar que não sobrou referência**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros. Se acusar `safeGetAccount` não usado, é porque a remoção do Step 3 ficou incompleta.

- [ ] **Step 5: [VERIFICAÇÃO HUMANA — não executar] Provar o handshake e a assinatura**

Exige API rodando e uma mensagem real. Fica pendente para o dono do projeto. Com a API rodando e `META_WEBHOOK_VERIFY_TOKEN=teste-local` no `.env`:

```bash
curl -s "http://localhost:3333/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=teste-local&hub.challenge=42"
```
Expected: `42`.

```bash
curl -s "http://localhost:3333/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42"
```
Expected: `403` com `hub.verify_token inválido`.

Depois mande uma mensagem real para o número e confirme que ela entra no inbox — é o que prova que o HMAC com o secret do env confere.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/webhooks/whatsapp.ts
git commit -m "feat(whatsapp): webhook valida assinatura e handshake com credenciais do app"
```

---

### Task 6: Remover `appSecret` e `verifyToken` da conta

Migração destrutiva e intencional: deixar as colunas mortas é o caminho para a verificação de assinatura voltar a ler o segredo errado em silêncio.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `WhatsAppAccount`)
- Modify: `apps/api/src/lib/whatsapp/connection.ts` (interfaces, `decrypt`, `upsertConnection`)
- Modify: `apps/api/src/routes/whatsapp/index.ts:42-72` (schemas), `:129-141` (`toMaskedConnection`)
- Modify: consumidores no dashboard (identificados no Step 1)

**Interfaces:**
- Consumes: Task 5 (o webhook já não depende dessas colunas).
- Produces: `DecryptedAccount` sem `appSecret`/`verifyToken`; `UpsertConnectionInput` reduzido a `{ accessToken, phoneNumberId, wabaId, appId?, webhookBaseUrl? }`.

- [ ] **Step 1: Mapear todos os consumidores antes de mexer**

Run: `grep -rn "appSecret\|verifyToken" apps/api/src apps/dashboard --include=*.ts --include=*.tsx`

Anote a lista. Os esperados: `connection.ts`, `routes/whatsapp/index.ts`, `webhook-panel.tsx`, `credentials-form.tsx`, `connection-status.tsx`, `readiness.ts`. Qualquer arquivo fora dessa lista precisa ser tratado nesta task também — não deixe para depois.

- [ ] **Step 2: Remover as colunas do schema**

Em `apps/api/prisma/schema.prisma`, no model `WhatsAppAccount`, apague as linhas `appSecret` e `verifyToken`.

- [ ] **Step 3: Sincronizar o banco**

Derrubar coluna faz o `prisma db push` pedir confirmação interativa, e o shell aqui é não-interativo — o comando erra em vez de perguntar. A flag é obrigatória:

Run: `pnpm --filter @workspace/api exec prisma db push --accept-data-loss`
Expected: aviso de que as colunas `appSecret` e `verifyToken` serão removidas, seguido de `Your database is now in sync with your Prisma schema.` A perda é intencional — os valores passaram para o env na Task 5.

- [ ] **Step 4: Ajustar `connection.ts`**

- `DecryptedAccount`: remova `accessToken`-vizinhos `appSecret` e `verifyToken`.
- `UpsertConnectionInput`: remova `appSecret` e `verifyToken`.
- `decrypt`: passa a decifrar só `accessToken`:

```typescript
const decrypt = (record: WhatsAppAccount): DecryptedAccount => {
  try {
    return { ...record, accessToken: decryptSecret(record.accessToken) }
  } catch (error) {
```

- `upsertConnection`: `secrets` vira só o token:

```typescript
  const secrets = { accessToken: encryptSecret(input.accessToken) }
```

e remova `verifyToken: input.verifyToken` do objeto `data`.

- [ ] **Step 5: Ajustar os schemas da rota**

Em `apps/api/src/routes/whatsapp/index.ts`: remova `appSecret` e `verifyToken` de `connectionSchema`, de `connectionBodySchema` e de `toMaskedConnection`.

- [ ] **Step 6: Ajustar o dashboard**

Para cada arquivo da lista do Step 1: remova o campo do formulário, da exibição e de qualquer tipo local. O `webhook-panel.tsx` mostra o verify token como valor copiável — troque o texto por uma nota de que o token agora é configurado no App Dashboard da Meta, não gerado por conta.

- [ ] **Step 7: Verificar**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros. Erros aqui são o mapa do que ficou pendente.

- [ ] **Step 8: [CONTROLLER — não executar] Regenerar o client antes de checar o dashboard**

Exige a API de pé; o controller da execução roda este passo. Anote na sua nota de saída que ficou pendente.

`connectionSchema`, `connectionBodySchema` e `toMaskedConnection` perderam campos — mudaram o body **e** a resposta. Sem regenerar, o dashboard typechecka verde contra um client velho e só quebra em runtime:

```bash
curl -s http://localhost:3333/health
pnpm generate:api
```
Expected: `health` = `ok`; `packages/api-client/src/types.gen.ts` sem `appSecret` e sem `verifyToken`.

- [ ] **Step 9: Verificar o dashboard contra o client novo**

Run: `pnpm --filter @workspace/dashboard typecheck`
Expected: sem erros. Se acusar campo inexistente, é consumidor que escapou do grep do Step 1.

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/lib/whatsapp/connection.ts apps/api/src/routes/whatsapp/index.ts apps/dashboard/app/ packages/api-client/src/
git commit -m "refactor(whatsapp): app secret e verify token saem da conta e passam a vir do env"
```

---

### Task 7: Troca do authorization code por access token

**Files:**
- Create: `apps/api/src/lib/whatsapp/oauth.ts`
- Test: `apps/api/src/lib/whatsapp/oauth.test.mjs`

**Interfaces:**
- Consumes: `env.META_APP_ID`, `env.META_APP_SECRET` (Task 1); `GRAPH_API_VERSION`, `GraphApiError` de `graph-client.js`.
- Produces:
  - `buildTokenExchangeUrl(params: { appId: string; appSecret: string; code: string }): string`
  - `exchangeCodeForToken(code: string): Promise<string>`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/lib/whatsapp/oauth.test.mjs`:

```javascript
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTokenExchangeUrl } from './oauth.ts'

test('monta a url de troca com os tres parametros obrigatorios', () => {
  const url = new URL(
    buildTokenExchangeUrl({
      appId: '123',
      appSecret: 'segredo',
      code: 'AQB-code',
    }),
  )

  assert.equal(url.origin, 'https://graph.facebook.com')
  assert.equal(url.pathname.endsWith('/oauth/access_token'), true)
  assert.equal(url.searchParams.get('client_id'), '123')
  assert.equal(url.searchParams.get('client_secret'), 'segredo')
  assert.equal(url.searchParams.get('code'), 'AQB-code')
})

test('escapa valores com caractere reservado', () => {
  const url = new URL(
    buildTokenExchangeUrl({
      appId: '123',
      appSecret: 'a b&c',
      code: 'x/y+z',
    }),
  )

  assert.equal(url.searchParams.get('client_secret'), 'a b&c')
  assert.equal(url.searchParams.get('code'), 'x/y+z')
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm --filter @workspace/api test`
Expected: FAIL — `Cannot find module './oauth.ts'`.

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/whatsapp/oauth.ts`:

```typescript
import { env } from '@/env.js'

import { GRAPH_API_VERSION, GraphApiError } from './graph-client.js'

const REQUEST_TIMEOUT_MS = 15_000

interface TokenExchangeParams {
  appId: string
  appSecret: string
  code: string
}

export const buildTokenExchangeUrl = ({
  appId,
  appSecret,
  code,
}: TokenExchangeParams) => {
  const query = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })

  return `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${query}`
}

interface TokenResponse {
  access_token?: string
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string }
}

/**
 * O `code` do Embedded Signup é de uso único e curta duração — falhar aqui
 * significa refazer o fluxo no browser, então o erro precisa chegar ao usuário
 * com a mensagem original da Meta.
 */
export const exchangeCodeForToken = async (code: string) => {
  const appId = env.META_APP_ID
  const appSecret = env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new GraphApiError(
      'META_APP_ID e META_APP_SECRET precisam estar configuradas para usar o Embedded Signup.',
      { status: 500 },
    )
  }

  let response: Response

  try {
    response = await fetch(buildTokenExchangeUrl({ appId, appSecret, code }), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new GraphApiError(
      error instanceof Error ? error.message : 'Falha ao contatar a Graph API.',
      { status: 502 },
    )
  }

  const body = (await response.json().catch(() => null)) as
    | (TokenResponse & GraphErrorBody)
    | null

  if (!response.ok) {
    throw new GraphApiError(body?.error?.message ?? response.statusText, {
      status: response.status,
      code: body?.error?.code,
      type: body?.error?.type,
    })
  }

  if (!body?.access_token) {
    throw new GraphApiError(
      'A Meta respondeu sem `access_token` na troca do código.',
      { status: 502 },
    )
  }

  return body.access_token
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm --filter @workspace/api test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/whatsapp/oauth.ts apps/api/src/lib/whatsapp/oauth.test.mjs
git commit -m "feat(whatsapp): troca do authorization code do Embedded Signup por access token"
```

---

### Task 8: Job de disparo do sync SMB

A chamada à SMB App Data API é **one-shot com prazo de 24h a partir do onboarding**. Se ela não for disparada na Fase 1, a janela expira sem uso e `smb_app_state_sync`/`history` só voltam a ser obteníveis desconectando e reconectando o número pelo celular.

O job desta task não faz parsing nenhum — ele apenas pede os dados. Os eventos resultantes caem no `pushWebhookLog` e no log `Evento do WhatsApp sem handler` da Task 4, que é exatamente o insumo da Task 12. É o mínimo que torna a captura possível sem antecipar a Fase 2.

**Files:**
- Create: `apps/api/src/jobs/whatsapp-smb-sync.ts`
- Modify: `apps/api/src/lib/whatsapp/graph-client.ts` (adicionar `requestSmbAppData`)
- Modify: `apps/api/src/plugins/queue.ts` (registrar o job)

**Interfaces:**
- Consumes: `getAccountById` de `connection.js`; `createQueue`/`createWorker` de `lib/queue.js`.
- Produces:
  - `requestSmbAppData(token: string, phoneNumberId: string, syncType: 'smb_app_state_sync' | 'history'): Promise<{ success: boolean }>`
  - `whatsappSmbSyncQueue` e `registerWhatsappSmbSyncJob(app: FastifyInstance): void`
  - Job data: `{ accountId: string }`

- [ ] **Step 1: Adicionar a chamada da Graph API**

Em `apps/api/src/lib/whatsapp/graph-client.ts`, depois de `subscribeApp`:

```typescript
export type SmbSyncType = 'smb_app_state_sync' | 'history'

/**
 * Pede à Meta o envio dos dados do app do celular (contatos e histórico). A
 * resposta é só o aceite — os dados chegam depois, pelos webhooks `history` e
 * `smb_app_state_sync`.
 */
export const requestSmbAppData = (
  token: string,
  phoneNumberId: string,
  syncType: SmbSyncType,
) =>
  request<{ success: boolean }>(`/${phoneNumberId}/smb_app_data`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
  })
```

- [ ] **Step 2: Criar o job**

Crie `apps/api/src/jobs/whatsapp-smb-sync.ts`:

```typescript
/**
 * Dispara o sync inicial dos dados do app do celular (coexistence).
 *
 * Vive numa fila e não inline na rota de onboarding porque a janela para pedir
 * esses dados é de 24h e só existe uma vez: uma instabilidade momentânea da
 * Meta não pode queimá-la sem retentativa.
 */
import type { FastifyInstance } from 'fastify'

import { createQueue, createWorker } from '@/lib/queue.js'
import { getAccountById } from '@/lib/whatsapp/connection.js'
import { requestSmbAppData } from '@/lib/whatsapp/graph-client.js'

export interface WhatsappSmbSyncJobData {
  accountId: string
}

export const whatsappSmbSyncQueue =
  createQueue<WhatsappSmbSyncJobData>('whatsapp-smb-sync')

export const registerWhatsappSmbSyncJob = (app: FastifyInstance) => {
  const worker = createWorker<WhatsappSmbSyncJobData>(
    'whatsapp-smb-sync',
    async job => {
      const account = await getAccountById(job.data.accountId)

      // Conta desativada entre o enfileiramento e a execução: nada a pedir.
      if (!account) return

      // Contatos antes do histórico: as mensagens referenciam gente que os
      // contatos nomeiam, e a ordem inversa deixaria tudo sem nome até o fim.
      await requestSmbAppData(
        account.accessToken,
        account.phoneNumberId,
        'smb_app_state_sync',
      )

      await requestSmbAppData(
        account.accessToken,
        account.phoneNumberId,
        'history',
      )
    },
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Job whatsapp-smb-sync falhou')
  })

  app.addHook('onClose', async () => {
    await worker.close()
    await whatsappSmbSyncQueue.close()
  })
}
```

- [ ] **Step 3: Registrar o job**

Em `apps/api/src/plugins/queue.ts`, siga o padrão já usado por `registerWhatsappInboundJob` — mesmo import style, mesma posição (jobs comuns, não a seção de scheduled):

```typescript
import { registerWhatsappSmbSyncJob } from '@/jobs/whatsapp-smb-sync.js'
```

```typescript
  registerWhatsappSmbSyncJob(app)
```

- [ ] **Step 4: Verificar**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros.

- [ ] **Step 5: [VERIFICAÇÃO HUMANA — não executar] Confirmar que a fila aparece no Bull Board**

Exige API rodando. Fica pendente para o dono do projeto: abrir `http://localhost:3333/admin/queues` e conferir que a fila `whatsapp-smb-sync` aparece (vazia). O Bull Board descobre filas via `getRegisteredQueues()`, então a ausência significaria que o Step 3 não pegou.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/jobs/whatsapp-smb-sync.ts apps/api/src/lib/whatsapp/graph-client.ts apps/api/src/plugins/queue.ts
git commit -m "feat(whatsapp): job de disparo do sync inicial dos dados do app"
```

> **Verificar durante a execução:** o path `/{phone_number_id}/smb_app_data` e o nome do campo `sync_type` vêm da documentação da Meta e não foram observados em resposta real. Se a chamada devolver erro de path inválido, confira o endpoint atual no App Dashboard antes de reescrever a lógica — o desenho do job não muda, só a URL.

---

### Task 9: Rota `POST /whatsapp/connection/embedded-signup`

**Files:**
- Create: `apps/api/src/routes/whatsapp/embedded-signup.ts`
- Modify: `apps/api/src/routes/whatsapp/index.ts` (registro do plugin)

**Interfaces:**
- Consumes: `exchangeCodeForToken` (Task 7); `upsertConnection`, `updateConnectionMeta` (Task 6); `whatsappSmbSyncQueue` (Task 8); `getPhoneNumberInfo`, `subscribeApp`, `GraphApiError` de `graph-client.js`.
- Produces: rota com `operationId: 'connectWhatsappEmbeddedSignup'`, body `{ code, phoneNumberId, wabaId }`, resposta `{ phoneNumberId, wabaId, displayPhoneNumber, verifiedName }`.

- [ ] **Step 1: Escrever a rota**

Crie `apps/api/src/routes/whatsapp/embedded-signup.ts`:

```typescript
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { whatsappSmbSyncQueue } from '@/jobs/whatsapp-smb-sync.js'
import { requireRole } from '@/lib/auth-guard.js'
import {
  updateConnectionMeta,
  upsertConnection,
} from '@/lib/whatsapp/connection.js'
import { isEncryptionConfigured } from '@/lib/whatsapp/crypto.js'
import {
  GraphApiError,
  getPhoneNumberInfo,
  subscribeApp,
} from '@/lib/whatsapp/graph-client.js'
import { exchangeCodeForToken } from '@/lib/whatsapp/oauth.js'

const bodySchema = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
})

const responseSchema = z.object({
  phoneNumberId: z.string(),
  wabaId: z.string(),
  displayPhoneNumber: z.string().nullable(),
  verifiedName: z.string().nullable(),
})

const embeddedSignupRoutes: FastifyPluginAsyncZod = async app => {
  app.post(
    '/connection/embedded-signup',
    {
      schema: {
        operationId: 'connectWhatsappEmbeddedSignup',
        tags: ['WhatsApp'],
        summary: 'Conclui o Embedded Signup e grava a conexão (coexistence)',
        body: bodySchema,
        response: { 200: responseSchema },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.badRequest(
          'WHATSAPP_ENCRYPTION_KEY não configurada — defina a chave no .env da API',
        )
      }

      const { code, phoneNumberId, wabaId } = request.body

      try {
        const accessToken = await exchangeCodeForToken(code)

        // Coexistence NÃO chama /register: o número já está registrado pelo app
        // do celular e registrar aqui o tiraria de lá.
        const account = await upsertConnection({
          accessToken,
          phoneNumberId,
          wabaId,
        })

        // Idempotência defensiva — o Embedded Signup já assina o app na WABA, e
        // a assinatura dos fields é configuração de app no App Dashboard.
        await subscribeApp(accessToken, wabaId)

        // Bloqueante de propósito: `display_phone_number` é o MSISDN da empresa
        // e é o que classifica direção no backfill de histórico (Fase 3).
        const info = await getPhoneNumberInfo(accessToken, phoneNumberId)

        await updateConnectionMeta({
          displayPhoneNumber: info.display_phone_number ?? null,
          verifiedName: info.verified_name ?? null,
          qualityRating: info.quality_rating ?? null,
          lastCheckedAt: new Date(),
        })

        // A janela para pedir os dados do app é de 24h e não se repete — o
        // enfileiramento vem logo após a conta existir, não no fim do handler.
        await whatsappSmbSyncQueue.add('smb-sync', { accountId: account.id })

        app.emitRealtimeEvent({
          entity: 'whatsappConnection',
          action: 'updated',
          entityId: phoneNumberId,
        })

        return {
          phoneNumberId,
          wabaId,
          displayPhoneNumber: info.display_phone_number ?? null,
          verifiedName: info.verified_name ?? null,
        }
      } catch (error) {
        if (!(error instanceof GraphApiError)) throw error

        const message = error.code
          ? `${error.message} (código ${error.code})`
          : error.message

        return error.status < 500
          ? reply.badRequest(message)
          : reply.badGateway(message)
      }
    },
  )
}

export default embeddedSignupRoutes
```

- [ ] **Step 2: Registrar o plugin**

Abra `apps/api/src/routes/whatsapp/index.ts` e localize a linha que registra as rotas de template:

Run: `grep -n "templatesRoutes" apps/api/src/routes/whatsapp/index.ts`

Adicione o import ao lado do de `templatesRoutes` (linha 33):

```typescript
import embeddedSignupRoutes from './embedded-signup.js'
```

E replique a linha de registro encontrada pelo grep, trocando o identificador — se ela for `await app.register(templatesRoutes)`, a nova é `await app.register(embeddedSignupRoutes)`, imediatamente acima ou abaixo. Se o registro usar `{ prefix }`, **não** repita o prefixo: o path da rota nova (`/connection/embedded-signup`) já é completo dentro de `/whatsapp`.

- [ ] **Step 3: Verificar tipos**

Run: `pnpm --filter @workspace/api typecheck`
Expected: sem erros.

- [ ] **Step 4: [CONTROLLER — não executar] Provar a rota e regenerar o client**

Exige a API de pé; o controller da execução roda estes passos e o commit do client sai junto do dele. Anote na sua nota de saída que ficou pendente.

```bash
curl -s http://localhost:3333/health
curl -s http://localhost:3333/docs/openapi.json | grep -c "connectWhatsappEmbeddedSignup"
pnpm generate:api
```
Expected: `health` = `ok`; grep ≥ 1; `connectWhatsappEmbeddedSignup` presente em `packages/api-client/src/sdk.gen.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/whatsapp/embedded-signup.ts apps/api/src/routes/whatsapp/index.ts packages/api-client/src/
git commit -m "feat(whatsapp): rota de conclusao do Embedded Signup"
```

---

### Task 10: Botão de Embedded Signup no dashboard

**Files:**
- Create: `apps/dashboard/app/(protected)/(general)/conexao/_components/embedded-signup-button.tsx`
- Delete: `apps/dashboard/app/(protected)/(general)/conexao/_components/credentials-form.tsx`
- Modify: `apps/dashboard/app/(protected)/(general)/conexao/_components/client.tsx:7,47`

**Interfaces:**
- Consumes: `connectWhatsappEmbeddedSignup` do SDK gerado (Task 9); `env.NEXT_PUBLIC_META_APP_ID`, `env.NEXT_PUBLIC_META_ES_CONFIG_ID` (Task 1).
- Produces: `<EmbeddedSignupButton />`.

- [ ] **Step 1: Criar o componente**

Crie `embedded-signup-button.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'

import { connectWhatsappEmbeddedSignup } from '@workspace/api-client/sdk'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { env } from '@/config/env'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js'
const GRAPH_VERSION = 'v25.0'

interface SignupData {
  phone_number_id?: string
  waba_id?: string
}

export const EmbeddedSignupButton = () => {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const signupData = useRef<SignupData | null>(null)

  const appId = env.NEXT_PUBLIC_META_APP_ID
  const configId = env.NEXT_PUBLIC_META_ES_CONFIG_ID

  useEffect(() => {
    if (!appId) return

    // O SDK precisa da callback global definida antes do script carregar.
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION })
    }

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = SDK_SRC
      script.async = true
      document.body.appendChild(script)
    }

    // O phone_number_id e o waba_id só chegam por postMessage; o callback do
    // FB.login devolve apenas o code.
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return

      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type !== 'WA_EMBEDDED_SIGNUP') return

        if (parsed.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          signupData.current = parsed.data
        }
      } catch {
        // Mensagem que não é JSON não é do fluxo de signup.
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appId])

  const onConnect = () => {
    if (!configId) return

    setIsPending(true)

    window.FB?.login(
      async response => {
        const code = response?.authResponse?.code
        const data = signupData.current

        if (!code || !data?.phone_number_id || !data?.waba_id) {
          setIsPending(false)
          toast.error('Conexão cancelada antes de concluir o cadastro.')
          return
        }

        const result = await connectWhatsappEmbeddedSignup({
          body: {
            code,
            phoneNumberId: data.phone_number_id,
            wabaId: data.waba_id,
          },
        })

        setIsPending(false)

        if (result.error) {
          toast.error('Não foi possível concluir a conexão.')
          return
        }

        toast.success('Número conectado — ele continua ativo no celular.')
        invalidateByTags(queryClient, ['WhatsApp'])
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar número</CardTitle>
        <CardDescription>
          O número continua funcionando no app WhatsApp Business do celular. Nada
          de token colado à mão — a Meta devolve as credenciais no fim do fluxo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appId && configId ? (
          <Button onClick={onConnect} disabled={isPending}>
            <MessageCircle className="size-4" />
            {isPending ? 'Conectando...' : 'Conectar com o WhatsApp'}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Defina NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_ES_CONFIG_ID para
            habilitar a conexão.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Declarar os tipos do SDK**

Crie `apps/dashboard/types/facebook.d.ts`:

```typescript
interface FBLoginResponse {
  authResponse?: { code?: string }
}

interface FBLoginOptions {
  config_id: string
  response_type: string
  override_default_response_type: boolean
  extras: Record<string, unknown>
}

interface FBSdk {
  init: (params: {
    appId: string
    autoLogAppEvents: boolean
    xfbml: boolean
    version: string
  }) => void
  login: (
    callback: (response: FBLoginResponse) => void,
    options: FBLoginOptions,
  ) => void
}

declare global {
  interface Window {
    FB?: FBSdk
    fbAsyncInit?: () => void
  }
}

export {}
```

- [ ] **Step 3: Trocar o componente na página**

Em `client.tsx`, troque o import de `CredentialsForm` por `EmbeddedSignupButton` (linha 7) e o uso dentro do grid (linha 47):

```tsx
import { EmbeddedSignupButton } from './embedded-signup-button'
```

```tsx
        <EmbeddedSignupButton />
        <ConnectionStatus />
```

- [ ] **Step 4: Apagar o formulário manual**

```bash
git rm "apps/dashboard/app/(protected)/(general)/conexao/_components/credentials-form.tsx"
```

- [ ] **Step 5: Verificar**

Run: `pnpm --filter @workspace/dashboard typecheck`
Run: `pnpm --filter @workspace/dashboard lint`
Expected: sem erros nos dois.

- [ ] **Step 6: [VERIFICAÇÃO HUMANA — não executar] Provar o fluxo ponta a ponta**

Exige browser, credenciais reais da Meta e o celular. Fica pendente para o dono do projeto: abrir `/conexao`, clicar em "Conectar com o WhatsApp" e concluir o fluxo. **É o passo que valida a Fase 1 inteira** — se o popup não abrir, conferir `NEXT_PUBLIC_META_ES_CONFIG_ID` e se o domínio está liberado no App Dashboard.

- [ ] **Step 7: Commit**

```bash
git add "apps/dashboard/app/(protected)/(general)/conexao/_components/" apps/dashboard/types/facebook.d.ts
git commit -m "feat(whatsapp): Embedded Signup no dashboard substitui o form de credenciais"
```

---

### Task 11: Remover o registro de número e atualizar o guia

Sob coexistence, `POST /{phone_number_id}/register` é ativamente danoso: tira o número do app do celular, que é exatamente o que a feature existe para evitar.

**Files:**
- Modify: `apps/api/src/lib/whatsapp/graph-client.ts:104-117`
- Modify: `apps/api/src/routes/whatsapp/index.ts` (endpoint de register + `readinessCheckSchema`)
- Modify: `apps/api/src/lib/whatsapp/readiness.ts`
- Modify: `apps/dashboard/.../conexao/_components/readiness-panel.tsx`
- Modify: `apps/dashboard/.../conexao/_components/setup-guide.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `readinessCheckSchema.action` reduzido a `z.enum(['subscribe_app', 'select_number']).nullable()`.

- [ ] **Step 1: Localizar tudo que depende do register**

Run: `grep -rn "registerPhoneNumber\|register_number" apps/api/src apps/dashboard --include=*.ts --include=*.tsx`

- [ ] **Step 2: Remover do `graph-client.ts`**

Apague `registerPhoneNumber` (linhas 104-117) junto do comentário acima dela.

- [ ] **Step 3: Remover da rota**

Em `routes/whatsapp/index.ts`: apague o handler que chama `registerPhoneNumber` (por volta da linha 445, incluindo seu `pushWebhookLog`), o import, e tire `'register_number'` do `readinessCheckSchema`.

- [ ] **Step 4: Ajustar o readiness**

Leia `apps/api/src/lib/whatsapp/readiness.ts` inteiro antes de editar — o formato exato dos checks (`id`, `label`, `status`, `detail`, `action`) precisa ser preservado.

Localize o check que devolve `action: 'register_number'`. Sob coexistence ele muda de significado: deixa de ser "falta registrar" e passa a ser "o número está registrado pelo app do celular". Mantenha o mesmo `id` e `label`, e:

- troque `action: 'register_number'` por `action: null` em todos os ramos do check;
- no ramo que hoje devolve `status: 'pending'` por falta de registro, devolva `status: 'ok'` com `detail` explicando que em coexistence o registro vem do app WhatsApp Business do celular e não é feito por aqui;
- preserve intactos os demais ramos (`error`, `skipped`) e os outros checks do arquivo.

Não crie check novo e não mexa no check de `subscribe_app`.

- [ ] **Step 5: Ajustar o painel**

Em `readiness-panel.tsx`: remova o branch que renderiza o botão de `register_number` (e o dialog de PIN, se houver).

- [ ] **Step 6: Reescrever o guia**

Em `setup-guide.tsx`, substitua os passos de "gerar token permanente / colar credenciais / registrar número com PIN" por:

1. Ter o app **WhatsApp Business** instalado no celular (versão 2.24.17 ou superior) com o número já em uso.
2. Clicar em "Conectar com o WhatsApp" nesta página e concluir o fluxo da Meta.
3. Manter o app do celular aberto normalmente — as mensagens aparecem nos dois lados.
4. Para desconectar: no celular, Configurações → Conta → Plataforma Business → Desconectar.

Inclua também o teto de **20 msg/s** e a lista do que não funciona em coexistence (grupos, mensagens temporárias, view-once, listas de transmissão, chamadas, catálogo/pedidos).

- [ ] **Step 7: Verificar**

Run: `pnpm --filter @workspace/api typecheck`
Run: `pnpm --filter @workspace/dashboard typecheck`
Run: `pnpm --filter @workspace/api test`
Expected: sem erros; testes passando.

- [ ] **Step 8: [CONTROLLER — não executar] Regenerar o client**

O `readinessCheckSchema` mudou, então o schema de resposta mudou. Exige a API de pé; o controller da execução roda este passo. Anote na sua nota de saída que ficou pendente.

```bash
curl -s http://localhost:3333/health
pnpm generate:api
```
Expected: `health` = `ok`; `packages/api-client/src/types.gen.ts` sem `register_number`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lib/whatsapp/graph-client.ts apps/api/src/lib/whatsapp/readiness.ts apps/api/src/routes/whatsapp/index.ts "apps/dashboard/app/(protected)/(general)/conexao/_components/" packages/api-client/src/
git commit -m "refactor(whatsapp): remove registro de numero, incompativel com coexistence"
```

---

### Task 12: [VERIFICAÇÃO HUMANA — não despachar] Verificação final e captura dos payloads

Esta task não escreve código: ela produz o insumo do plano da Fase 2. Todos os passos exigem App Dashboard da Meta, celular e a API em ambiente público — nenhum é executável por subagente. Fica integralmente com o dono do projeto.

**Files:** nenhum.

**Interfaces:**
- Consumes: todas as tasks anteriores.
- Produces: `docs/superpowers/notes/2026-XX-XX-coexistence-payloads.md` com os corpos crus dos três eventos.

- [ ] **Step 1: Rodar a verificação completa do monorepo**

Run: `pnpm lint`
Run: `pnpm typecheck`
Run: `pnpm --filter @workspace/api test`
Expected: os três passam. Não prossiga com falha em nenhum.

- [ ] **Step 2: Assinar os três fields no App Dashboard**

No App Dashboard da Meta → WhatsApp → Configuration → Webhook fields, marque `history`, `smb_app_state_sync` e `smb_message_echoes` (além de `messages`, que já está).

- [ ] **Step 3: Provocar cada evento**

- `smb_message_echoes`: mande uma mensagem **pelo celular** para um contato qualquer.
- `smb_app_state_sync` e `history`: disparados pelo job da Task 8 no momento do onboarding. Confirme no Bull Board que o job `whatsapp-smb-sync` concluiu; os eventos chegam em seguida, o `history` possivelmente em vários chunks ao longo de minutos.

Se o job falhou nas 3 tentativas, os dados **não** podem ser pedidos de novo sem desconectar e reconectar o número pelo celular — a janela é única. Nesse caso, corrija a causa (o erro está no log do worker) e refaça o onboarding antes de seguir.

- [ ] **Step 4: Capturar os payloads**

Em `/conexao`, no console de webhooks, expanda cada evento novo e copie o JSON. Os eventos sem handler também aparecem no log da API com `Evento do WhatsApp sem handler`.

Salve em `docs/superpowers/notes/` um arquivo com um bloco por field, o JSON íntegro, e a data da captura.

- [ ] **Step 5: Responder a pergunta em aberto da spec**

Mande uma mensagem **pelo dashboard** e verifique no console se um `smb_message_echoes` chega para ela. Anote a resposta no arquivo de payloads — é o que decide se a Fase 2 precisa de guarda contra duplicação de outbound próprio.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/
git commit -m "docs(whatsapp): payloads reais dos webhooks de coexistence"
```

---

## Depois deste plano

Com os payloads capturados, escrever o plano da Fase 2 (`echoes.ts`, `contacts.ts`, campo `origin`, badge no front) e depois o da Fase 3 (SMB App Data API, fila `whatsapp-history`, backfill). Ambos seguem a mesma spec.

> Criado em 2026-08-03 11:24 (-03) · Última modificação: 2026-08-03 11:52 (-03)
