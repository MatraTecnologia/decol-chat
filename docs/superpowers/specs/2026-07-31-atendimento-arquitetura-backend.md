# Arquitetura do backend de atendimento conversacional (WhatsApp Cloud API)

Design do núcleo de atendimento: modelagem, RBAC, atribuição automática e endpoints.
Ancorado no que já existe no repositório — Fastify 5, Prisma 7, Better Auth, BullMQ + Redis,
Socket.io — e não numa base nova.

---

## 1. Premissas e desvios do pedido original

Dois pontos do pedido divergem do que já está de pé. Ambos foram resolvidos aqui em vez de
virarem pergunta bloqueante.

### 1.1 Autenticação: manter Better Auth, não trocar por JWT

O pedido cita "JWT para autenticação". O repositório já tem uma stack de auth completa e
testada: sessões em Postgres com Redis como `secondaryStorage`, 2FA (TOTP + OTP por e-mail +
backup codes), `freshAge` de 1h para ações sensíveis, rate limit por rota, cookie cache de 60s
e hooks de auditoria em `databaseHooks`. Substituir isso por JWT emitido à mão é regressão de
segurança e de funcionalidade, não construção.

**Decisão:** manter Better Auth como fonte de verdade da sessão e estender o plugin `admin`
com as quatro roles. Se depois surgir necessidade de token para serviço-a-serviço (worker
externo, integração de BI, app mobile sem cookie), o Better Auth tem plugin `jwt` que emite
JWT assinado a partir da mesma sessão — é o caminho para o que o JWT resolveria, sem descartar
o resto.

### 1.2 Tenancy: single-tenant, com o gancho para multi já plantado

`WhatsAppConnection` hoje é `@id @default("singleton")` — um deploy atende uma empresa. A lista
de entidades pedida também não tem `Organization`. O design segue single-tenant.

Mas `Conversation` e `Contact` já carregam `whatsAppAccountId` desde o dia um. Isso libera
**múltiplos números no mesmo deploy** agora, e transforma um eventual `organizationId` em uma
migração aditiva (coluna + índice + um `where` a mais no scope) em vez de um redesenho.

### 1.3 `WhatsAppAccount` é renomeação de código em produção, não modelo novo

`CONNECTION_ID = 'singleton'` está fixo em `lib/whatsapp/connection.ts` e atravessa
`readiness.ts`, as 8 rotas de `routes/whatsapp/index.ts` e o `safeGetConnection` do webhook.
A migração para `WhatsAppAccount` preserva a linha existente como a primeira conta e exige
tocar esses call sites — está listado como passo explícito na §8, não é de graça.

---

## 2. Prisma Schema

Adicionar em `apps/api/prisma/schema.prisma`, na seção `APPLICATION TABLES`.
Os modelos de Better Auth permanecem intocados; `User` ganha apenas relações.

### 2.1 Enums

```prisma
enum ConversationStatus {
  OPEN
  PENDING
  CLOSED
}

enum ConversationPriority {
  LOW
  MEDIUM
  HIGH
}

enum ConversationChannel {
  WHATSAPP
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  PENDING    // aceita localmente, ainda não entregue à Graph API
  SENT
  DELIVERED
  READ
  FAILED
}

enum MessageType {
  TEXT
  IMAGE
  AUDIO
  VIDEO
  DOCUMENT
  STICKER
  LOCATION
  CONTACTS
  TEMPLATE
  INTERACTIVE
  REACTION
  SYSTEM
  UNSUPPORTED
}

enum AssignmentReason {
  AUTO_ROUND_ROBIN
  MANUAL
  REASSIGNED
  UNASSIGNED
  RELEASED_ON_CLOSE
}

enum DistributionStrategy {
  ROUND_ROBIN
  LEAST_BUSY
}
```

> `MessageType.UNSUPPORTED` existe de propósito: a Meta adiciona tipos novos sem aviso, e um
> enum estrito faria a ingestão quebrar em produção num tipo desconhecido.

### 2.2 Conta do WhatsApp

Generaliza a `WhatsAppConnection` atual. Campos e semântica de criptografia idênticos.

```prisma
model WhatsAppAccount {
  id                 String    @id @default(cuid(2))
  label              String    // nome interno, ex.: "Comercial SP"
  accessToken        String    // AES-256-GCM
  appSecret          String    // AES-256-GCM — necessário para validar o HMAC
  phoneNumberId      String    @unique
  wabaId             String
  appId              String?
  verifyToken        String
  webhookBaseUrl     String?
  displayPhoneNumber String?
  verifiedName       String?
  qualityRating      String?
  lastCheckedAt      DateTime?
  isActive           Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  contacts         Contact[]
  conversations    Conversation[]
  distributionRule DistributionRule?

  @@index([isActive])
  @@map("whatsapp_account")
}
```

`phoneNumberId` é `@unique` porque o webhook resolve a conta a partir do
`entry[].changes[].value.metadata.phone_number_id` do payload da Meta.

### 2.3 Contato

```prisma
model Contact {
  id                String   @id @default(cuid(2))
  whatsAppAccountId String
  waId              String   // MSISDN que a Meta manda em `messages[].from`
  phoneNumber       String   // normalizado E.164
  phoneKey          String?  // canônica p/ dedupe — ver §2.3.1
  name              String?  // profile.name do payload
  profileName       String?
  email             String?
  notes             String?
  isBlocked         Boolean  @default(false)
  metadata          Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  whatsAppAccount WhatsAppAccount @relation(fields: [whatsAppAccountId], references: [id], onDelete: Cascade)
  conversations   Conversation[]

  @@unique([whatsAppAccountId, waId])
  @@unique([whatsAppAccountId, phoneKey])
  @@index([phoneNumber])
  @@map("contact")
}
```

O `@@unique([whatsAppAccountId, waId])` é o que torna o `upsert` de contato na ingestão
idempotente — o mesmo cliente falando com dois números da empresa vira dois contatos, que é o
comportamento correto (as conversas são separadas).

### 2.3.1 Nono dígito brasileiro — `phoneKey`

A Meta devolve `wa_id` de celular brasileiro **sem** o nono dígito (`554399140409`), enquanto o
número que se digita tem o 9 (`5543999140409`). O `@@unique([whatsAppAccountId, waId])` não vê
duplicata entre os dois: o mesmo cliente vira **dois contatos e duas conversas** — um criado no
envio, outro criado pelo webhook.

`phoneKey` é a forma canônica, usada **só para dedupe**. O `waId` continua sendo o valor da
Meta: é ele que casa o webhook e para quem se responde. Por isso as duas uniques coexistem.

Implementação em `apps/api/src/lib/whatsapp/phone.ts`:

| Função | Papel |
|---|---|
| `phoneKey(v)` | canônica para dedupe — celular BR perde o 9 |
| `toSendFormat(v)` | forma de envio — celular BR **ganha** o 9 de volta |
| `formatPhone(v)` | máscara de exibição |
| `isValidPhone(v)` | validação de formulário |

**A regra é mais estreita que "tirar o 9".** Fixo brasileiro tem 12 dígitos e nunca teve o
nono. E remover o 9 cegamente colide: o celular `43 9 3222-1111` viraria `43 3222-1111`, que é
um fixo — dois assinantes distintos na mesma chave. A numeração resolve: o bloco de 8 dígitos
de um celular sempre começou em **6–9**, o de um fixo em **2–5**. Então só se remove o 9 quando
o dígito seguinte está em 6–9. Número estrangeiro nunca é tocado.

```
5543999140409  →  554399140409   (digitado)
554399140409   →  554399140409   (wa_id da Meta)   ✓ mesma chave
554332221111   →  554332221111   (fixo, intacto)   ✓ sem colisão
12125550123    →  12125550123    (EUA, intocado)
```

**Migração:** a coluna entrou nullable, seguida de backfill com detecção de colisão
(`scripts/backfill-phone-key.ts`, que aborta e lista as linhas conflitantes), e só então a
constraint. Aplicar tudo de uma vez faria o `db:push` falhar no meio contra a base real.

### 2.4 Conversa

```prisma
model Conversation {
  id                String               @id @default(cuid(2))
  whatsAppAccountId String
  contactId         String
  assignedToId      String?
  teamId            String?

  status   ConversationStatus   @default(OPEN)
  priority ConversationPriority @default(MEDIUM)
  channel  ConversationChannel  @default(WHATSAPP)

  subject         String?
  lastMessageAt   DateTime?
  lastMessageText String?              // preview desnormalizado para a lista
  lastInboundAt   DateTime?            // base da janela de 24h — ver §6.4
  unreadCount     Int                  @default(0)
  assignedAt      DateTime?
  closedAt        DateTime?
  closedById      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  whatsAppAccount   WhatsAppAccount                 @relation(fields: [whatsAppAccountId], references: [id], onDelete: Cascade)
  contact           Contact                         @relation(fields: [contactId], references: [id], onDelete: Cascade)
  assignedTo        User?                           @relation("ConversationAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  closedBy          User?                           @relation("ConversationCloser", fields: [closedById], references: [id], onDelete: SetNull)
  team              Team?                           @relation(fields: [teamId], references: [id], onDelete: SetNull)
  messages          Message[]
  assignmentHistory ConversationAssignmentHistory[]

  @@index([assignedToId, status, lastMessageAt(sort: Desc)])
  @@index([status, lastMessageAt(sort: Desc)])
  @@index([contactId])
  @@index([whatsAppAccountId, status])
  @@map("conversation")
}
```

**Por que os campos desnormalizados:** `lastMessageAt`, `lastMessageText` e `unreadCount` evitam
subquery ou `include` de mensagens na tela principal do produto (lista de conversas com
paginação e ordenação). São escritos na mesma transação que insere a mensagem — ver §5.3.

**Índice principal:** `[assignedToId, status, lastMessageAt DESC]` cobre exatamente a query do
VENDEDOR (minhas conversas abertas, mais recentes primeiro), que é a mais quente do sistema.

Não há `@@unique` em `[contactId, status]` — o Prisma não expressa unique parcial. A
serialização de "uma conversa aberta por contato" é feita com **advisory lock por contato** na
transação de ingestão (§5.3). Sem isso, duas mensagens do mesmo cliente com segundos de
diferença criam duas conversas: são wamids diferentes, então o unique de `waMessageId` não
protege esse caso.

### 2.5 Mensagem

```prisma
model Message {
  id             String   @id @default(cuid(2))
  conversationId String
  senderId       String?  // null quando INBOUND (quem falou foi o contato)

  direction MessageDirection
  type      MessageType      @default(TEXT)
  status    MessageStatus    @default(PENDING)

  waMessageId  String?  @unique // wamid — chave de idempotência
  waTimestamp  DateTime?

  content      String?  // texto puro / caption
  mediaId      String?  // media id da Meta
  mediaUrl     String?  // URL já rehospedada (R2)
  mediaMimeType String?
  templateName String?

  errorCode    String?
  errorMessage String?

  deliveredAt DateTime?
  readAt      DateTime?
  failedAt    DateTime?

  payload   Json?    // payload cru da Meta — indispensável para depurar
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User?        @relation(fields: [senderId], references: [id], onDelete: SetNull)

  @@index([conversationId, createdAt(sort: Desc)])
  @@index([status])
  @@map("message")
}
```

**`waMessageId String? @unique` é a restrição mais importante do schema.** A Meta reenvia
webhooks quando não recebe 200 rápido o suficiente, e reenvia em caso de erro. Sem esse unique,
uma reentrega duplica mensagem, duplica conversa e dispara uma segunda atribuição. É `nullable`
porque uma mensagem OUTBOUND existe localmente (`PENDING`) antes de a Graph API devolver o
wamid.

### 2.6 Histórico de atribuição

```prisma
model ConversationAssignmentHistory {
  id             String           @id @default(cuid(2))
  conversationId String
  fromUserId     String?          // null na primeira atribuição
  toUserId       String?          // null quando a conversa é liberada
  actorId        String?          // null quando foi o sistema (round-robin)
  reason         AssignmentReason
  note           String?
  createdAt      DateTime         @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  fromUser     User?        @relation("AssignmentFrom", fields: [fromUserId], references: [id], onDelete: SetNull)
  toUser       User?        @relation("AssignmentTo", fields: [toUserId], references: [id], onDelete: SetNull)
  actor        User?        @relation("AssignmentActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([conversationId, createdAt(sort: Desc)])
  @@index([toUserId, createdAt(sort: Desc)])
  @@map("conversation_assignment_history")
}
```

A separação entre `actorId` (quem executou) e `toUserId` (quem recebeu) é o que permite
distinguir "o gestor reatribuiu para o vendedor" de "o sistema atribuiu sozinho". O índice em
`[toUserId, createdAt]` alimenta o relatório de desempenho por vendedor.

### 2.7 Equipe

Modelo fino, sem herança de permissão. Existe porque `DistributionRule` precisa de um escopo
e equipe é o escopo natural — não para criar um segundo eixo de autorização.

```prisma
model Team {
  id          String   @id @default(cuid(2))
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members           TeamMember[]
  conversations     Conversation[]
  distributionRules DistributionRule[]

  @@map("team")
}

model TeamMember {
  id       String   @id @default(cuid(2))
  teamId   String
  userId   String
  joinedAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([userId])
  @@map("team_member")
}
```

### 2.8 Regra de distribuição

```prisma
model DistributionRule {
  id       String  @id @default(cuid(2))
  name     String
  isActive Boolean @default(true)

  whatsAppAccountId String? @unique // uma regra por número; null = regra global
  teamId            String?         // pool restrito a uma equipe

  strategy DistributionStrategy @default(ROUND_ROBIN)

  requireOnline       Boolean @default(true)  // exige presença ativa no Socket.io
  maxOpenPerAgent     Int?                    // teto de conversas abertas por vendedor
  fallbackToAnyActive Boolean @default(true)  // ninguém online → distribui entre ativos
  reassignOnReopen    Boolean @default(false) // conversa reaberta volta pro dono anterior?

  businessHours Json? // { tz, days: [{ weekday, start, end }] } — fora disso, fica na fila

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  whatsAppAccount WhatsAppAccount? @relation(fields: [whatsAppAccountId], references: [id], onDelete: Cascade)
  team            Team?            @relation(fields: [teamId], references: [id], onDelete: SetNull)

  @@index([isActive])
  @@map("distribution_rule")
}
```

### 2.9 Adições ao `User`

O modelo do Better Auth ganha só relações e dois campos operacionais. `role` e `banned` já
existem e são reaproveitados — não criar tabela `Role` própria (§3.1).

```prisma
model User {
  // ... campos existentes do Better Auth (não alterar)

  // atendimento
  isAvailable    Boolean   @default(true)  // toggle manual "aceito novas conversas"
  lastAssignedAt DateTime?                 // desempate do round-robin

  conversations       Conversation[]                  @relation("ConversationAssignee")
  closedConversations Conversation[]                  @relation("ConversationCloser")
  messages            Message[]
  teamMemberships     TeamMember[]
  assignmentsFrom     ConversationAssignmentHistory[] @relation("AssignmentFrom")
  assignmentsTo       ConversationAssignmentHistory[] @relation("AssignmentTo")
  assignmentsActed    ConversationAssignmentHistory[] @relation("AssignmentActor")
}
```

---

## 3. Entidades e relacionamentos

```
WhatsAppAccount 1──n Contact
WhatsAppAccount 1──n Conversation
WhatsAppAccount 1──1 DistributionRule (opcional)

Contact         1──n Conversation
Conversation    1──n Message
Conversation    1──n ConversationAssignmentHistory
Conversation    n──1 User   (assignedTo, opcional)
Conversation    n──1 Team   (opcional)

User            1──n Message (sender, apenas OUTBOUND)
User            n──n Team via TeamMember
Team            1──n DistributionRule
```

Cardinalidades que merecem nota:

- **Contato → Conversa é 1:N, não 1:1.** O mesmo cliente pode ter várias conversas ao longo do
  tempo; no máximo uma delas está em `OPEN`/`PENDING` por vez. Isso preserva o histórico
  fechado sem inflar a conversa ativa.
- **Mensagem → Usuário é opcional.** `INBOUND` não tem `senderId` — quem falou foi o contato,
  que não é usuário do sistema.
- **Conversa → Equipe é opcional e informativa.** Serve para relatório e para escopo de regra;
  não concede acesso a ninguém (ver §4.4).

---

## 4. Autorização (RBAC)

### 4.1 Roles

Estender `packages/shared/src/roles.ts` e `permissions.ts` — o plugin `admin` do Better Auth
já suporta roles customizadas via `ac.newRole`.

| Role | Key | Escopo de leitura | Envia | Reatribui | Administra |
|---|---|---|---|---|---|
| Administrador | `admin` | todas | sim | sim | usuários, regras, contas |
| Gestor | `manager` | todas | sim | sim | não mexe em admin |
| Vendedor | `agent` | só atribuídas a si | só nas suas | não | não |
| Somente leitura | `viewer` | só atribuídas a si | **não** | não | não |

```typescript
// packages/shared/src/permissions.ts
const statement = {
  ...defaultStatements,
  member: ['read'],
  conversation: ['read', 'read:own', 'write', 'assign', 'close', 'delete'],
  message: ['read', 'read:own', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read', 'write'],
  whatsappAccount: ['read', 'write'],
  report: ['read', 'read:team'],
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
  member: ['read'],
  conversation: ['read', 'write', 'assign', 'close', 'delete'],
  message: ['read', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read', 'write'],
  whatsappAccount: ['read', 'write'],
  report: ['read'],
})

export const manager = ac.newRole({
  member: ['read'],
  conversation: ['read', 'write', 'assign', 'close'],
  message: ['read', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read'],
  whatsappAccount: ['read'],
  report: ['read', 'read:team'],
})

export const agent = ac.newRole({
  conversation: ['read:own', 'write', 'close'],
  message: ['read:own', 'send'],
  contact: ['read'],
})

export const viewer = ac.newRole({
  conversation: ['read:own'],
  message: ['read:own'],
})
```

### 4.2 O ponto crítico: RBAC precisa ser escopo de query, não guarda de rota

"VENDEDOR visualiza apenas conversas atribuídas a ele" **não** é garantido por `requireRole`.
Se a autorização parar no guard, todo endpoint de listagem vaza — e são muitos: lista de
conversas, busca, contadores, relatório, mensagens de uma conversa, exportação.

A regra: **um único helper devolve o fragmento `where`, e nenhuma leitura de conversa ou
mensagem pode ser escrita sem ele.**

```typescript
// apps/api/src/routes/conversations/guards.ts
import type { Prisma } from '@/generated/prisma/client.js'
import { requireAuth } from '@/lib/auth-guard.js'

const GLOBAL_READERS = ['admin', 'manager']

/** Fragmento `where` obrigatório em TODA leitura de conversa. */
export const scopeConversations = (
  role: string,
  userId: string,
): Prisma.ConversationWhereInput =>
  GLOBAL_READERS.includes(role) ? {} : { assignedToId: userId }

/** Idem para mensagens — o filtro atravessa a relação. */
export const scopeMessages = (
  role: string,
  userId: string,
): Prisma.MessageWhereInput =>
  GLOBAL_READERS.includes(role)
    ? {}
    : { conversation: { assignedToId: userId } }

/**
 * Carrega a conversa já dentro do escopo do solicitante.
 * Fora do escopo devolve null — o handler responde 404, não 403: um vendedor
 * não deve conseguir descobrir que a conversa de outro existe.
 */
export const findScopedConversation = async (
  request: FastifyRequest,
  conversationId: string,
) => {
  const { session, role } = await requireRole(request, [
    'admin', 'manager', 'agent', 'viewer',
  ])

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...scopeConversations(role, session.user.id) },
  })

  return { conversation, session, role }
}
```

Escopo fora do escopo devolve **404, não 403** — de propósito. 403 confirma que o recurso
existe, o que é vazamento de informação entre vendedores concorrentes.

### 4.3 Regras que o sistema de permissões não expressa

Duas regras do enunciado são *baseadas no alvo*, não no ator. Nenhum sistema de statements
resolve isso; precisam de verificação explícita no momento da mutação.

**a) "GESTOR não pode excluir administrador"** — depende da role do usuário-alvo:

```typescript
// apps/api/src/routes/users/guards.ts
export const assertCanManageTarget = async (
  actorRole: string,
  targetUserId: string,
  request: FastifyRequest,
) => {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  })

  if (!target) return null // o handler responde 404

  // Gestor não toca em admin — nem exclui, nem edita, nem rebaixa.
  if (actorRole === 'manager' && target.role === 'admin') {
    throw new Error('FORBIDDEN_TARGET_ADMIN')
  }

  return target
}
```

Cobre exclusão, edição e mudança de role — não só o `delete` citado no enunciado, porque um
gestor que pode rebaixar um admin para `agent` e depois excluí-lo contorna a regra.

**b) "VENDEDOR envia mensagens apenas nas conversas atribuídas"** — o `POST /conversations/:id/messages`
deve reusar `findScopedConversation` e, adicionalmente, recusar `viewer` (que tem `read:own` mas
não `message: send`).

### 4.4 Equipe não concede acesso

`Conversation.teamId` existe para relatório e escopo de regra de distribuição. Um vendedor da
equipe X **não** enxerga a conversa de um colega da mesma equipe — o enunciado é explícito
("Não acessa conversas de outros vendedores"). Se essa regra mudar depois, o ponto de mudança é
uma linha em `scopeConversations`, e só.

---

## 5. Atribuição automática

### 5.1 Onde mora a correção

Este é o ponto que mais erra em sistemas assim, então vale ser direto:

**Redis escolhe *quem* recebe. Redis não impede atribuição dupla.** Quem impede são duas
restrições no Postgres:

1. **`Message.waMessageId @unique`** — idempotência na ingestão. A Meta reenvia; a segunda
   entrega falha no insert e nenhuma segunda conversa nem segunda atribuição é criada.
2. **`updateMany` condicional** — árbitro final da corrida de atribuição.

Isso importa porque o repositório já engole falhas de Redis de propósito (`lib/cache.ts`,
`lib/whatsapp/webhook-log.ts` são best-effort). Um design cuja correção dependa de um lock
Redis contradiz a postura do próprio código: Redis cai, e o sistema tem que continuar correto,
não só continuar de pé.

### 5.2 Fluxo completo

```
POST /webhooks/whatsapp
  ├─ verifica HMAC (já implementado em lib/whatsapp/signature.ts)
  ├─ enfileira o payload cru na fila `whatsapp-inbound`
  └─ responde 200 imediatamente          ← a Meta desativa a assinatura em falhas repetidas

worker `whatsapp-inbound`
  ├─ resolve WhatsAppAccount por metadata.phone_number_id
  ├─ para cada statuses[]  → atualiza Message por waMessageId (§6.3)
  └─ para cada messages[]
       ├─ upsert Contact  (unique [whatsAppAccountId, waId])
       ├─ transação:
       │    ├─ acha conversa OPEN|PENDING do contato, ou cria
       │    ├─ insere Message (unique waMessageId → duplicata aborta aqui)
       │    └─ atualiza lastMessageAt / lastMessageText / lastInboundAt / unreadCount
       ├─ se conversation.assignedToId == null
       │    └─ enfileira `conversation-assign` com jobId = conversationId
       └─ emite Socket.io: entity 'message' + 'conversation'

worker `conversation-assign`  (concurrency: 1)
  ├─ recarrega a conversa; já atribuída → encerra
  ├─ resolve DistributionRule (por conta → global → default)
  ├─ monta o pool de elegíveis (§5.4)
  ├─ pool vazio → status PENDING, reagenda com backoff
  ├─ Redis: escolhe o próximo (§5.5)
  ├─ transação: updateMany({ where: { id, assignedToId: null } })
  │    ├─ count === 0 → outro processo ganhou; encerra
  │    └─ count === 1 → grava ConversationAssignmentHistory (AUTO_ROUND_ROBIN)
  └─ emite Socket.io
```

### 5.3 Ingestão idempotente

Duas corridas distintas acontecem aqui e cada uma tem sua própria proteção:

| Corrida | Cenário | Proteção |
|---|---|---|
| Mesma mensagem duas vezes | Meta reenvia o webhook | `Message.waMessageId @unique` |
| Duas mensagens seguidas do mesmo contato | cliente manda "oi" e "tudo bem?" em 2s | **advisory lock por contato** |

O segundo caso é o que passa despercebido: são wamids diferentes, o unique não vê nada, e
`findFirst` + `create` sob Read Committed deixa os dois jobs criarem uma conversa cada.
`pg_advisory_xact_lock` serializa por contato e é liberado no commit — sem tabela de lock, sem
TTL, sem lock órfão.

```typescript
const persistInbound = async (account, contact, waMessage) =>
  prisma.$transaction(async tx => {
    // Serializa a ingestão por contato até o commit. Sem isso, duas mensagens
    // quase simultâneas do mesmo cliente criam duas conversas abertas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contact.id}))`

    const conversation =
      (await tx.conversation.findFirst({
        where: { contactId: contact.id, status: { in: ['OPEN', 'PENDING'] } },
        orderBy: { lastMessageAt: 'desc' },
      })) ??
      (await tx.conversation.create({
        data: {
          whatsAppAccountId: account.id,
          contactId: contact.id,
          status: 'OPEN',
        },
      }))

    // Duplicata da Meta bate no unique de waMessageId e aborta a transação.
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: mapType(waMessage.type),
        status: 'DELIVERED',
        waMessageId: waMessage.id,
        waTimestamp: new Date(Number(waMessage.timestamp) * 1000),
        content: extractText(waMessage),
        payload: waMessage,
      },
    })

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.waTimestamp ?? new Date(),
        lastMessageText: message.content?.slice(0, 280) ?? null,
        lastInboundAt: message.waTimestamp ?? new Date(),
        unreadCount: { increment: 1 },
        // Conversa fechada que recebe mensagem nova é reaberta pelo findFirst
        // acima só se estiver OPEN|PENDING; senão nasce uma conversa nova.
      },
    })

    return { conversation, message }
  })
```

A duplicata é tratada capturando `P2002` no worker e encerrando o job como sucesso — reentrega
da Meta não é erro.

### 5.4 Elegibilidade do pool

```typescript
const eligibleAgents = async (rule: DistributionRule) => {
  const candidates = await prisma.user.findMany({
    where: {
      role: 'agent',              // viewer NUNCA entra no pool
      banned: { not: true },      // campo já existe no Better Auth
      isAvailable: true,
      ...(rule.teamId
        ? { teamMemberships: { some: { teamId: rule.teamId } } }
        : {}),
    },
    select: { id: true, lastAssignedAt: true },
  })

  const online = rule.requireOnline
    ? candidates.filter(u => presence.isOnline(u.id))
    : candidates

  const pool = online.length === 0 && rule.fallbackToAnyActive ? candidates : online

  if (!rule.maxOpenPerAgent) return pool

  const load = await prisma.conversation.groupBy({
    by: ['assignedToId'],
    where: {
      assignedToId: { in: pool.map(u => u.id) },
      status: { in: ['OPEN', 'PENDING'] },
    },
    _count: true,
  })

  const byUser = Object.fromEntries(load.map(l => [l.assignedToId, l._count]))

  return pool.filter(u => (byUser[u.id] ?? 0) < rule.maxOpenPerAgent!)
}
```

> **Restrição a declarar:** `lib/presence.ts` é **em memória**. Com mais de uma réplica da API,
> `requireOnline` passa a ver só os sockets da própria réplica e o pool fica errado. Antes de
> escalar horizontalmente, mover presença para Redis (`SET` por usuário com TTL + heartbeat) ou
> desligar `requireOnline`. Enquanto for réplica única, funciona como está.

### 5.5 Round-robin no Redis

Duas estratégias, ambas atômicas:

**ROUND_ROBIN — lista circular com `RPOPLPUSH`:**

```typescript
const key = `assign:rr:${rule.id}`

// Reconstrói a lista quando o pool muda (hash do pool guardado ao lado).
// RPOPLPUSH sobre a MESMA chave é atômico e rotaciona o cursor:
// o elemento sai do fim e volta pro começo numa única operação.
const nextUserId = await redis.rpoplpush(key, key)
```

Com N processos concorrentes, cada um recebe um usuário diferente — o Redis serializa os
comandos. Não há necessidade de lock.

**LEAST_BUSY — sorted set por carga:**

```typescript
// score = número de conversas abertas; ZPOPMIN pega o menos ocupado e remove
const key = `assign:load:${rule.id}`
const [userId] = await redis.zpopmin(key)
await redis.zadd(key, currentLoad + 1, userId)  // devolve com carga incrementada
```

Para o `LEAST_BUSY` valer a pena, o score precisa ser reconciliado periodicamente com o
`groupBy` do Postgres (job a cada poucos minutos), porque o Redis pode divergir.

**Deduplicação de job:** em vez de um `SET NX` artesanal, usar o `jobId` do BullMQ —
`queue.add('assign', { conversationId }, { jobId: conversationId })`. O BullMQ recusa um segundo
job com o mesmo id enquanto o primeiro não terminou, o job fica visível no Bull Board (que já
está de pé em `/admin/queues`) e não há lock órfão a expirar.

### 5.6 A escrita que decide

Atribuição e histórico vão na **mesma** transação: um crash entre as duas escritas deixaria uma
conversa atribuída sem trilha, e o histórico é requisito explícito.

```typescript
const won = await prisma.$transaction(async tx => {
  const assigned = await tx.conversation.updateMany({
    where: { id: conversationId, assignedToId: null },  // ← a condição é tudo
    data: { assignedToId: userId, assignedAt: new Date(), status: 'OPEN' },
  })

  // Outro worker, ou um gestor pela UI, atribuiu primeiro.
  if (assigned.count === 0) return false

  await tx.conversationAssignmentHistory.create({
    data: {
      conversationId,
      fromUserId: null,
      toUserId: userId,
      actorId: null,               // null = sistema
      reason: 'AUTO_ROUND_ROBIN',
    },
  })

  await tx.user.update({
    where: { id: userId },
    data: { lastAssignedAt: new Date() },
  })

  return true
})
```

**Perder a corrida não exige compensação no Redis.** `RPOPLPUSH key key` já devolveu o usuário
para o início da lista — a rotação se restaura sozinha. Um `LPUSH` "devolvendo o crédito"
inseriria uma *segunda* cópia e daria peso dobrado àquele vendedor para sempre. (No
`LEAST_BUSY` é o contrário: `ZPOPMIN` remove de fato, então o `ZADD` de volta é obrigatório.)

`updateMany` com `assignedToId: null` no `where` é um compare-and-swap: o Postgres garante que
exatamente um dos concorrentes vê `count === 1`. **Se o Redis estiver fora do ar inteiro, a
correção não é afetada** — só a distribuição fica pior (cai no fallback de ordenar por
`lastAssignedAt`).

### 5.7 Reatribuição manual

Mesmo mecanismo, condição diferente — o gestor sobrescreve um dono existente, então a proteção
é contra *escrita concorrente*, não contra dono não-nulo:

```typescript
const result = await prisma.conversation.updateMany({
  where: { id, assignedToId: expectedCurrentAssigneeId }, // vem do cliente
  data: { assignedToId: newUserId, assignedAt: new Date() },
})
// count === 0 → 409 Conflict: "a conversa foi reatribuída por outra pessoa"
```

Toda reatribuição grava histórico com `reason: 'MANUAL'` ou `'REASSIGNED'` e `actorId` = quem
executou.

---

## 6. Integração com a Meta Cloud API

### 6.1 O que já existe

`lib/whatsapp/`: `crypto.ts` (AES-256-GCM), `connection.ts`, `graph-client.ts`, `signature.ts`
(HMAC do webhook), `webhook-log.ts`, `readiness.ts`. O webhook em
`routes/webhooks/whatsapp.ts` já valida o HMAC sobre o **raw body** (content-type parser
escopado) e já responde 200 incondicionalmente após validar — as duas propriedades difíceis
estão prontas.

### 6.2 O que muda no webhook

Hoje o handler valida e loga. Passa a valer:

```
verifica HMAC → enfileira payload cru → 200
```

Nada de processamento síncrono. O `pushWebhookLog` continua (é a ferramenta de diagnóstico da
página de conexão), e a persistência vira responsabilidade do worker. Isso mantém a latência
baixa o suficiente para a Meta e torna a ingestão retentável.

### 6.3 Status de mensagem precisa ser monotônico

A Meta entrega `statuses[]` **fora de ordem**. Um `delivered` que chega depois de um `read` não
pode rebaixar a mensagem.

A verificação **não pode** ser ler-depois-escrever: dois webhooks de status em voo leem `SENT`,
um grava `READ`, o outro grava `DELIVERED`, e o último a escrever vence — a checagem de ordem é
contornada. O guard vai dentro do `where`, mesmo padrão do §5.6.

```typescript
/** Estados que podem ser sobrescritos por cada status recebido. */
const LOWER_THAN: Record<MessageStatus, MessageStatus[]> = {
  PENDING:   [],
  SENT:      ['PENDING'],
  DELIVERED: ['PENDING', 'SENT'],
  READ:      ['PENDING', 'SENT', 'DELIVERED'],
  FAILED:    ['PENDING', 'SENT'],
}

const applyStatus = async (waMessageId: string, incoming: MessageStatus) => {
  // count === 0 significa uma de três coisas, todas benignas: a mensagem ainda
  // não foi persistida, o status é regressão, ou já está FAILED (terminal).
  await prisma.message.updateMany({
    where: { waMessageId, status: { in: LOWER_THAN[incoming] } },
    data: {
      status: incoming,
      ...(incoming === 'DELIVERED' && { deliveredAt: new Date() }),
      ...(incoming === 'READ' && { readAt: new Date() }),
      ...(incoming === 'FAILED' && { failedAt: new Date() }),
    },
  })
}
```

`FAILED` sair terminal é consequência de não aparecer em nenhuma lista `LOWER_THAN` — não
precisa de checagem própria.

### 6.4 Janela de 24 horas

Fora de 24h desde a última mensagem **recebida**, a Meta recusa texto livre — só template passa.
Se isso não estiver no modelo de leitura, o vendedor recebe um código de erro cru da Graph API
no meio de um atendimento.

`Conversation.lastInboundAt` existe para isso. A resposta de `GET /conversations/:id` inclui:

```typescript
const canSendFreeText =
  conversation.lastInboundAt !== null &&
  Date.now() - conversation.lastInboundAt.getTime() < 24 * 60 * 60 * 1000

const windowExpiresAt = conversation.lastInboundAt
  ? new Date(conversation.lastInboundAt.getTime() + 24 * 60 * 60 * 1000)
  : null
```

O `POST /conversations/:id/messages` valida isso **antes** de chamar a Graph API e devolve 422
com mensagem em português explicando que só template é aceito — em vez de repassar o erro da
Meta.

### 6.5 Envio

```
POST /conversations/:id/messages
  ├─ findScopedConversation (RBAC)
  ├─ recusa role 'viewer'
  ├─ valida janela de 24h (§6.4)
  ├─ cria Message status=PENDING, direction=OUTBOUND, senderId=session.user.id
  ├─ chama sendTextMessage/sendTemplateMessage (graph-client.ts já existe)
  ├─ sucesso → update { waMessageId: wamid, status: 'SENT' }
  ├─ erro    → update { status: 'FAILED', errorCode, errorMessage }
  └─ emite Socket.io
```

A mensagem é persistida **antes** da chamada à Graph API. Se a API falhar, existe registro
`FAILED` visível na conversa em vez de uma mensagem que sumiu.

### 6.6 Eventos realtime

Registrar em `lib/realtime-events.ts` — sem isso o frontend não invalida nada:

```typescript
export type RealtimeEntity =
  | 'user'
  | 'whatsappConnection'
  | 'conversation'
  | 'message'
  | 'contact'

export const ENTITY_INVALIDATION_TAGS: Record<RealtimeEntity, string[]> = {
  user: ['Users'],
  whatsappConnection: ['WhatsApp'],
  conversation: ['Conversations'],
  message: ['Messages', 'Conversations'],
  contact: ['Contacts'],
}
```

`message` invalida `Conversations` também, porque toda mensagem muda o preview e a ordenação
da lista.

> **Nota de escala:** `emitRealtimeEvent` hoje é `io.emit()` — broadcast global. Um vendedor
> recebe evento de conversa que não pode ver, e o frontend dispara um refetch inútil (não é
> vazamento de dado — o refetch passa pelo RBAC do servidor — mas é ruído). Quando o volume
> justificar, trocar por rooms: `socket.join(\`user:\${userId}\`)` e emitir para o dono da
> conversa + a room `role:admin`/`role:manager`.

---

## 7. Endpoints REST iniciais

Convenção do repositório: diretório por domínio com `index.ts` autoloadado, `guards.ts` por
recurso, Zod para params/body/querystring/response, `operationId` + `tags` para o Swagger e
para a geração do `@workspace/api-client`.

### 7.1 Conversas — `routes/conversations/`

| Método | Rota | `operationId` | Roles | Nota |
|---|---|---|---|---|
| GET | `/conversations` | `listConversations` | todas | `scopeConversations` obrigatório; filtros `status`, `priority`, `assignedToId`, `teamId`, `q`, paginação |
| GET | `/conversations/:id` | `getConversation` | todas | inclui `canSendFreeText` e `windowExpiresAt` |
| PATCH | `/conversations/:id` | `updateConversation` | admin, manager, agent(own) | `status`, `priority`, `subject` |
| POST | `/conversations/:id/assign` | `assignConversation` | admin, manager | body: `{ userId, expectedAssigneeId?, note? }` → 409 em conflito |
| POST | `/conversations/:id/unassign` | `unassignConversation` | admin, manager | devolve à fila e reenfileira `conversation-assign` |
| POST | `/conversations/:id/close` | `closeConversation` | admin, manager, agent(own) | grava `closedAt` + `closedById` |
| POST | `/conversations/:id/reopen` | `reopenConversation` | admin, manager | respeita `reassignOnReopen` |
| POST | `/conversations/:id/read` | `markConversationRead` | todas (own) | zera `unreadCount` |
| GET | `/conversations/:id/history` | `listAssignmentHistory` | admin, manager | trilha de atribuição |

### 7.2 Mensagens — `routes/conversations/messages.ts` (subplugin)

| Método | Rota | `operationId` | Roles |
|---|---|---|---|
| GET | `/conversations/:id/messages` | `listMessages` | todas — `scopeMessages`, cursor por `createdAt` |
| POST | `/conversations/:id/messages` | `sendMessage` | admin, manager, agent(own) — **viewer recusado** |
| POST | `/conversations/:id/messages/template` | `sendTemplateMessage` | idem — único caminho fora da janela de 24h |

Paginação de mensagens é **cursor-based**, não offset: a lista cresce pelo topo em tempo real e
offset produz itens repetidos/pulados.

### 7.3 Contatos — `routes/contacts/`

| Método | Rota | `operationId` | Roles |
|---|---|---|---|
| GET | `/contacts` | `listContacts` | admin, manager (agent: só contatos das próprias conversas) |
| GET | `/contacts/:id` | `getContact` | idem |
| PATCH | `/contacts/:id` | `updateContact` | admin, manager |
| POST | `/contacts/:id/block` | `blockContact` | admin, manager |

### 7.4 Distribuição — `routes/distribution/`

| Método | Rota | `operationId` | Roles |
|---|---|---|---|
| GET | `/distribution/rules` | `listDistributionRules` | admin, manager (leitura) |
| POST | `/distribution/rules` | `createDistributionRule` | admin |
| PATCH | `/distribution/rules/:id` | `updateDistributionRule` | admin |
| DELETE | `/distribution/rules/:id` | `deleteDistributionRule` | admin |
| GET | `/distribution/pool` | `getDistributionPool` | admin, manager — quem está elegível **agora** e por quê |
| POST | `/distribution/rebalance` | `rebalanceQueue` | admin — reenfileira todas as `PENDING` sem dono |

`GET /distribution/pool` é a ferramenta de diagnóstico do round-robin: sem ela, "por que ninguém
recebeu essa conversa" vira investigação de log.

### 7.5 Equipes — `routes/teams/`

`GET /teams`, `POST /teams`, `PATCH /teams/:id`, `POST /teams/:id/members`,
`DELETE /teams/:id/members/:userId` — admin escreve, manager lê.

### 7.6 Atendentes e disponibilidade — `routes/agents/`

| Método | Rota | `operationId` | Roles |
|---|---|---|---|
| GET | `/agents` | `listAgents` | admin, manager — com carga atual e status online |
| PATCH | `/agents/me/availability` | `updateMyAvailability` | agent — toggle `isAvailable` |

### 7.7 Relatórios — `routes/reports/`

| Método | Rota | `operationId` | Roles |
|---|---|---|---|
| GET | `/reports/overview` | `getReportsOverview` | admin, manager |
| GET | `/reports/agents` | `getAgentPerformance` | admin, manager |

Métricas iniciais: conversas por status, tempo até primeira resposta, tempo médio de
fechamento, volume por vendedor, taxa de mensagens `FAILED`.

### 7.8 Usuários

Estender `routes/users/` com `assertCanManageTarget` (§4.3) nas mutações. A criação de usuário
continua pelo Better Auth (`admin.createUser`), não por rota própria.

---

## 8. Sequência de implementação

Ordem pensada para que cada passo seja verificável isoladamente e nada quebre o que já funciona.

1. **Schema + migração.** Enums, modelos novos, relações no `User`. `pnpm db:push` +
   `pnpm db:generate`.
2. **Migrar `WhatsAppConnection` → `WhatsAppAccount`.** Preservar a linha `singleton` como a
   primeira conta. Atualizar `connection.ts` (remover `CONNECTION_ID` fixo), `readiness.ts`, as
   8 rotas de `routes/whatsapp/` e o `safeGetConnection` do webhook. **A página de conexão e o
   painel de prontidão precisam continuar funcionando** — é o ponto de maior risco de regressão
   de todo o plano.
3. **Roles + permissions.** Estender `packages/shared/src/roles.ts` e `permissions.ts`; ajustar
   `authClient` no dashboard (`adminClient` recebe as roles novas) e o `AdminGate`.
   **Decidir o backfill das linhas com `role: 'user'`** — hoje `app/(protected)/layout.tsx`
   redireciona exatamente esse valor para `/not-authorized`, então deixar como está é seguro,
   mas é um estado morto. Recomendação: migrar para `viewer` (mesma capacidade de leitura, agora
   com acesso ao painel) e promover manualmente quem for virar vendedor.
4. **`guards.ts` de conversas.** `scopeConversations`, `scopeMessages`,
   `findScopedConversation`. Antes de qualquer rota — assim nenhuma rota nasce sem escopo.
5. **Fila de ingestão.** Webhook passa a enfileirar; worker `whatsapp-inbound` persiste contato,
   conversa e mensagem com idempotência por `waMessageId`.
6. **Worker de atribuição.** `conversation-assign` com `jobId = conversationId`, pool,
   round-robin no Redis e o `updateMany` condicional.
7. **Endpoints de leitura.** `listConversations`, `getConversation`, `listMessages`.
   `pnpm generate:api` (API precisa estar de pé — conferir `/health` antes).
8. **Endpoints de escrita.** Envio de mensagem com validação da janela de 24h, atribuição
   manual, fechamento.
9. **Realtime.** Entidades novas em `ENTITY_INVALIDATION_TAGS`; emissão nos handlers e no worker.
10. **Distribuição, equipes e relatórios.**

### Riscos a acompanhar

| Risco | Onde aparece | Mitigação |
|---|---|---|
| Regressão na página de conexão | passo 2 | Rodar o painel de prontidão ponta a ponta antes de seguir |
| Presença em memória | `lib/presence.ts` | Réplica única até mover para Redis; ou `requireOnline: false` |
| Broadcast global do Socket.io | `emitRealtimeEvent` | Aceitável no início; migrar para rooms sob volume |
| Divergência do score `LEAST_BUSY` | Redis vs Postgres | Job de reconciliação; começar com `ROUND_ROBIN` |
| Tipos de mensagem novos da Meta | ingestão | `MessageType.UNSUPPORTED` + `payload` cru sempre gravado |

---

> Criado em 2026-07-31 09:28 (-03) · Última modificação: 2026-07-31 13:17 (-03)
