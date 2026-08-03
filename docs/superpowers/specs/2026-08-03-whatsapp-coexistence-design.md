# WhatsApp Coexistence — Embedded Signup + ingestão do app do celular

## Objetivo

Conectar o número da empresa à Cloud API **sem tirá-lo do celular**. Hoje o onboarding é manual e termina em `registerPhoneNumber`, que migra o número para a Cloud API e o desativa no app do WhatsApp Business. A Coexistence da Meta permite o mesmo número ativo nos dois lados, com as mensagens espelhadas entre app e API.

Esta spec é a **Fase 2** prevista em [`2026-07-30-conexao-whatsapp-design.md`](./2026-07-30-conexao-whatsapp-design.md) §"Fase 2 (fora de escopo)". A dependência que motivou o corte na época — app Meta como Tech Provider com `config_id` aprovado — está resolvida: o app está em modo Live com Advanced Access.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Modo de conexão | Coexistence (app do celular + Cloud API no mesmo número) |
| Onboarding | Embedded Signup — **substitui** o formulário manual |
| Registro do número | Não acontece. Coexistence exige pular `registerPhoneNumber` |
| Cardinalidade | Uma conta, do próprio negócio (mantém o singleton atual) |
| Histórico anterior | Importado para o inbox |
| Autoria de mensagem vinda do celular | Campo novo `origin` em `Message` |
| `appSecret` / `verifyToken` | Saem da tabela, viram env (são do app, não da conta) |

## Restrições da plataforma (não são detalhe de implementação)

- Coexistence mantém o número no **app WhatsApp Business** (v2.24.17+), não no WhatsApp comum.
- Throughput fixo em **20 msg/s** para número em dual-platform. Disparo em massa por template esbarra nisso.
- Sem suporte a: grupos, mensagens temporárias, view-once, listas de transmissão, chamadas, catálogo/pedidos.
- O sync inicial via SMB App Data API é **one-shot com prazo de 24h** após o onboarding.
- O offboarding é feito pelo celular (Configurações → Conta → Plataforma Business → Desconectar) e **não notifica a aplicação**. O readiness passa a ser o detector.

---

## O defeito que motiva o router

`lib/whatsapp/inbound.ts:431-433`:

```ts
const phoneNumberId = value?.metadata?.phone_number_id
if (!value || !phoneNumberId) continue
```

Os eventos de coexistence (`smb_message_echoes`, `smb_app_state_sync`) não trazem `metadata` dentro de `value` — o identificador é o WABA id em `entry[].id`. Com o código atual eles seriam **descartados em silêncio**: o `extractPhoneNumberId` do webhook também retorna `null`, cai no `getConnection()` (que funciona por sermos single-account), a assinatura valida e a Meta recebe `200` — com zero ingestão e nenhum erro em lugar nenhum.

A ingestão precisa despachar por `changes[].field` **antes** de tentar resolver a conta.

---

## Arquitetura

### Onboarding (Fase 1)

```
/conexao  ──FB.login(config_id, response_type: code)──►  Meta
   │                                                       │
   │◄── postMessage WA_EMBEDDED_SIGNUP ────────────────────┘
   │    event: FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING
   │    data: { phone_number_id, waba_id }
   ▼
POST /whatsapp/connection/embedded-signup { code, phoneNumberId, wabaId }
   │
   ├─ exchangeCodeForToken(code)         GET /oauth/access_token
   ├─ upsertConnection(token cifrado)    ← SEM registerPhoneNumber
   ├─ subscribeApp(wabaId)
   ├─ getPhoneNumberInfo → displayPhoneNumber
   └─ enfileira job `whatsapp-smb-sync`
```

`getPhoneNumberInfo` é **bloqueante**: `displayPhoneNumber` é o MSISDN da empresa e é o que classifica direção no backfill. Falhou, o onboarding falha — não grava conta meio configurada.

### Ingestão (Fase 2 e 3)

```
lib/whatsapp/inbound/
  index.ts           # processInboundPayload — for entry → for change → switch (change.field)
  resolve-account.ts # cascata metadata.phone_number_id → entry.id
  shared.ts          # resolveContact, mapType, extractText, toWaTimestamp, isDuplicateMessage
  messages.ts        # 'messages' → código atual, sem mudança de comportamento
  echoes.ts          # 'smb_message_echoes'
  contacts.ts        # 'smb_app_state_sync'
  history.ts         # 'history'
```

`shared.ts` é extração pura do `inbound.ts` de hoje. `messages.ts` recebe o código existente intacto — é o que garante que a refatoração não regride o caminho que já funciona.

```ts
// resolve-account.ts
const resolveAccount = async (entry, value) =>
  (value?.metadata?.phone_number_id
    ? await getAccountByPhoneNumberId(value.metadata.phone_number_id)
    : null) ?? (entry?.id ? await getAccountByWabaId(entry.id) : null)
```

`getAccountByWabaId` é novo em `connection.ts`; a migração adiciona índice em `wabaId`. Evento sem conta continua em `warn` + descarte — mas por não existir, não por formato.

### Filas

`webhooks/whatsapp.ts` roteia antes de enfileirar:

```ts
const isHistory = changes.some(c => c.field === 'history')
await enqueue(isHistory ? whatsappHistoryQueue : whatsappInboundQueue, payload)
```

`whatsapp-history` roda com `concurrency: 1` — chunks disputando os mesmos advisory locks só geram contenção.

---

## Fluxo de dados

### Echoes → `Message`

Mensagens enviadas por alguém pelo app do celular.

| Campo | Valor | Motivo |
|---|---|---|
| `direction` | `OUTBOUND` | quem falou foi a empresa |
| `origin` | `WHATSAPP_APP` | campo novo |
| `senderId` | `null` | não existe `User` correspondente |
| `status` | `SENT` | a Meta não manda `statuses` para echo — `DELIVERED` seria mentira |
| contato | resolvido por `to` | `from` é o número da empresa |

Atualiza `lastMessageAt` e `lastMessageText`. **Não** toca `unreadCount` nem `lastInboundAt`: o atendente responder pelo celular não cria não-lida nem reabre a janela de 24h.

### Histórico → backfill

Caminho de persistência próprio. O caminho vivo (`ingestMessage`) faz **uma transação + um `pg_advisory_xact_lock` por mensagem** (`inbound.ts:315-319`); em 6 meses de histórico isso vira um rastejo, e `unreadCount: { increment: 1 }` / `lastInboundAt` são semântica de mensagem viva.

O backfill inverte a granularidade:

- agrupa o chunk por contato → **um lock e uma transação por thread**
- `createMany({ skipDuplicates: true })` — idempotência sem exception por item, o que torna o reprocesso de um chunk barato
- compartilha apenas `resolveContact` do `shared.ts`

**Direção:** `to` presente ⇒ `OUTBOUND` + `origin: WHATSAPP_APP`; senão compara `from` com o `displayPhoneNumber` da conta.

**Estado da conversa importada:**

| Última mensagem do thread | Status | Efeito |
|---|---|---|
| nas últimas 24h | `OPEN` | atendente assume de onde parou |
| mais antiga | `CLOSED`, `closedAt = lastMessageAt` | histórico consultável sem entupir a fila |

Em ambos: `unreadCount: 0`, e `lastInboundAt` = timestamp da última mensagem **inbound** do thread. Esse precisa ser real — é o que decide se a janela de 24h está aberta em conversa que vale responder.

**Realtime:** um evento por *conversa criada*, nunca por mensagem. Um chunk pode trazer milhares; emitir por mensagem afogaria o socket e o `merge-message-page` do front.

**Progresso:** o payload traz `phase`, `chunk_order` e `progress`. Gravado em Redis via `cache.set`, exposto em `GET /whatsapp/connection/sync-status` para a barra em `/conexao`. Sem isso um backfill de 20 minutos parece travamento.

---

## Mudanças de schema

```prisma
enum MessageOrigin {
  DASHBOARD
  WHATSAPP_APP
}

model Message {
  origin MessageOrigin?   // null em INBOUND
}

model WhatsAppAccount {
  // removidos: appSecret, verifyToken  (passam a ser do app, via env)
  @@index([wabaId])
}
```

`origin` entra no `messageSelect` (`routes/conversations/messages.ts`) — sem isso o `payload` do realtime não o carrega e a bolha não sabe que veio do celular. É mudança de response schema ⇒ `pnpm generate:api` com a API de pé (`/health` confirmado antes).

A remoção de `appSecret`/`verifyToken` é destrutiva e intencional. Sob Embedded Signup o segredo é do app e o webhook é registrado uma vez no App Dashboard; manter as colunas mortas é exatamente o caminho para a verificação de assinatura ler o segredo errado em silêncio.

## Variáveis de ambiente

| Var | App | Uso |
|---|---|---|
| `META_APP_ID` | api | troca do authorization code |
| `META_APP_SECRET` | api | troca do code + HMAC do webhook |
| `META_ES_CONFIG_ID` | api | validação do fluxo |
| `META_WEBHOOK_VERIFY_TOKEN` | api | handshake `GET /webhooks/whatsapp` |
| `NEXT_PUBLIC_META_APP_ID` | dashboard | `FB.init` |
| `NEXT_PUBLIC_META_ES_CONFIG_ID` | dashboard | `FB.login` |

`webhooks/whatsapp.ts` passa a ler o secret (`:227-231`) e o verify token (`:185`) do env em vez da conta.

---

## Arquivos

| Ação | Caminho |
|---|---|
| novo | `apps/api/src/routes/whatsapp/embedded-signup.ts` |
| novo | `apps/api/src/lib/whatsapp/oauth.ts` — `exchangeCodeForToken` |
| novo | `apps/api/src/lib/whatsapp/inbound/` (7 arquivos, ver Arquitetura) |
| novo | `apps/api/src/jobs/whatsapp-smb-sync.ts`, `apps/api/src/jobs/whatsapp-history.ts` |
| novo | `apps/dashboard/.../conexao/_components/embedded-signup-button.tsx` |
| removido | `apps/api/src/lib/whatsapp/inbound.ts` (vira o diretório) |
| removido | `credentials-form.tsx`, `PUT /whatsapp/connection`, `registerPhoneNumber`, ação `register_number` do readiness |
| editado | `webhooks/whatsapp.ts`, `connection.ts`, `routes/conversations/messages.ts`, `setup-guide.tsx` |

---

## Tratamento de erro

| Falha | Comportamento |
|---|---|
| troca de `code` falha | `400` com a mensagem original da Meta (via `toGraphError`). Nada gravado |
| `getPhoneNumberInfo` falha | onboarding falha — sem MSISDN o backfill classifica direção errado |
| job de sync esgota as 3 tentativas | status `failed` no Redis + botão "tentar novamente" em `/conexao`. A janela de 24h é curta demais para falhar em silêncio |
| chunk de histórico falha | BullMQ retenta; `skipDuplicates` torna o reprocesso idempotente por construção |
| evento sem conta resolvível | `warn` + descarte, resposta `200` mantida (a Meta desativa a assinatura após erros repetidos) |

O webhook continua respondendo `200` incondicionalmente depois da assinatura aceita — a posição já estabelecida em `webhooks/whatsapp.ts:260-262` não muda.

## Testes

Padrão `.test.mjs` com `node:test`, como os existentes. Cada handler separa **parse puro** de **persistência** para ser testável sem banco:

- `resolve-account.test.mjs` — cascata `metadata.phone_number_id` → `entry.id`, incluindo o caso hoje descartado
- `echoes.test.mjs` — `parseEchoes`: o contato sai de `to`, não de `from`
- `history.test.mjs` — `classifyHistoryMessage` contra o MSISDN; `OPEN` vs `CLOSED` pela idade; `lastInboundAt` ignorando as outbound

## Ordem de execução

| Fase | Entrega | Verificação |
|---|---|---|
| 0 | envs novos, três fields assinados no App Dashboard, router despachando por `field` e logando os desconhecidos | **payloads reais capturados em `/conexao`** |
| 1 | Embedded Signup, remoção do fluxo manual, `appSecret`/`verifyToken` → env | conectar o número e receber uma mensagem do celular |
| 2 | echoes + contatos + `origin` + `generate:api` + badge no front | mandar do celular e ver aparecer no inbox marcada |
| 3 | backfill + fila dedicada + progresso | conversas antigas no inbox com o estado correto |

**A Fase 0 é obrigatória e vem antes de qualquer parser.** Os nomes de campo dos três webhooks novos saem de payload observado, não de documentação de terceiro — o `pushWebhookLog` já persiste o corpo cru e o `/conexao` já o renderiza, então a captura não custa código novo.

## Questões em aberto

**`smb_message_echoes` ecoa o que o nosso dashboard envia pela Cloud API?** A redação da Meta ("messages the business customer sends with the WhatsApp Business app") sugere que não. Se ecoar, a mensagem colide no `@unique(waMessageId)` e o `isDuplicateMessage` a engole — que por acaso é o comportamento correto. Confirmar no payload capturado na Fase 0; não blindar preventivamente.

> Criado em 2026-08-03 10:58 (-03) · Última modificação: 2026-08-03 10:58 (-03)
