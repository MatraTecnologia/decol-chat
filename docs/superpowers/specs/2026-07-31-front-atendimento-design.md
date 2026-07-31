# Front de atendimento conversacional — design

Estrutura do dashboard para o produto de atendimento via WhatsApp: rotas, organização de
código, estado, realtime e RBAC no cliente.

Complementa o design de backend em
[`2026-07-31-atendimento-arquitetura-backend.md`](./2026-07-31-atendimento-arquitetura-backend.md).

**Este documento descreve o contrato que existe**, não o que se esperava dele. As rotas de
leitura foram implementadas e o `@workspace/api-client` foi regenerado antes desta escrita — os
tipos citados aqui são os de `packages/api-client/src/types.gen.ts`.

---

## 1. Decisões tomadas

| Decisão | Escolha |
|---|---|
| Escopo | As 6 telas, com faseamento explícito (§8) |
| Ordem | Backend de leitura primeiro — feito; o front nasce contra o client gerado |
| Layout da Inbox | 3 colunas, a 3ª colapsável |
| Inbox por role | Rota única, controles condicionados por role |
| Realtime | Híbrido: payload na thread aberta, invalidação por tag na lista |

---

## 2. O que o backend já expõe

Três operações, disponíveis no client gerado. O hey-api emitiu variantes `Infinite` para as
duas listas, que é o que a Inbox usa.

```typescript
import {
  listConversationsInfiniteOptions,
  getConversationOptions,
  listMessagesInfiniteOptions,
} from '@workspace/api-client/react-query'
```

### `GET /conversations` → `listConversations`

Query: `status`, `priority`, `assignedToId`, `teamId`, `q`, `scope`, `page`, `limit`.
Resposta paginada por offset: `{ data: [...], meta: { total, page, limit, totalPages, hasNext } }`.

Cada item traz a conversa completa mais `contact` (`id`, `waId`, `phoneNumber`, `name`,
`profileName`, `isBlocked`) e `assignedTo` (`id`, `name`, `email`, `image`) ou `null`.

> **Armadilha confirmada pela implementação:** `scope` tem default **`mine`**. Admin e manager
> que baterem sem parâmetro recebem só o que está atribuído a eles — normalmente vazio, já que
> conversa vai para vendedor. **A lista para admin/manager precisa mandar `scope=all`
> explicitamente.** Para `agent`/`viewer` os parâmetros `scope` e `assignedToId` são ignorados
> pelo servidor.

### `GET /conversations/:id` → `getConversation`

Mesmos campos, mais os dois calculados que o composer consome:

```typescript
canSendFreeText: boolean
windowExpiresAt: Date | null
```

### `GET /conversations/:id/messages` → `listMessages`

Query: `cursor`, `limit` (default 50, máx 100). Resposta: `{ data: [...], nextCursor: string | null }`.

**Formato do cursor (implementado):** opaco, `base64url` de `` `${createdAt.toISOString()}|${id}` ``.
Ordenação `[{ createdAt: 'desc' }, { id: 'desc' }]`, com o `id` desempatando mensagens gravadas
no mesmo milissegundo — rajada de webhook produz exatamente isso. Cursor malformado devolve
**400**, não 500.

O front trata o cursor como opaco. `getNextPageParam: last => last.nextCursor ?? undefined`.

### O que ainda NÃO existe

Envio, atribuição, fechamento, contatos, distribuição, equipes, relatórios e o worker de
ingestão. As fases 2 em diante (§8) dependem de rodadas de backend que ainda não aconteceram.

---

## 3. Rotas

```
(protected)/(general)/
  conversations/          Inbox — 3 colunas          todas as roles
  contacts/               Lista + ficha              admin, manager
  reports/                Overview + desempenho      admin, manager
  distribution/           Regras + pool ao vivo      admin escreve, manager lê
  teams/                  Equipes e membros          admin escreve, manager lê
  conexao/                já existe                  admin
(protected)/admin/users/  já existe                  admin
```

Sidebar em dois grupos: **Atendimento** (Conversas, Contatos, Relatórios) e **Configuração**
(Distribuição, Equipes, Conexão, Usuários), o segundo só para admin/manager. Vendedor e viewer
veem um item: Conversas.

`/conversations` passa a ser o destino pós-login para `agent` e `viewer`.

> **Nota:** o `AdminGate` cobre apenas `/admin/*` e libera só `admin`. As telas de manager vivem
> fora dele; a checagem de role é por item de sidebar e por rota, não por gate compartilhado.

---

## 4. Organização do código

A Inbox vira **feature module**; as telas menores seguem o padrão de rota com `_components/`,
que é onde ele funciona bem.

```
features/inbox/
├── index.ts                        # barrel
├── components/
│   ├── conversation-list/
│   │   ├── conversation-list.tsx       # coluna 1: virtualizada + infinite
│   │   ├── conversation-list-item.tsx  # avatar, preview, hora, badge de não-lidas
│   │   ├── conversation-filters.tsx    # status, prioridade, busca (nuqs)
│   │   └── scope-selector.tsx          # Minhas/Não atribuídas/Todas — admin+manager
│   ├── thread/
│   │   ├── thread.tsx                  # coluna 2: scroll invertido + infinite
│   │   ├── thread-header.tsx           # nome, status, ações
│   │   ├── message-bubble.tsx          # direção, tipo, timestamp
│   │   ├── message-status-icon.tsx     # PENDING→SENT→DELIVERED→READ→FAILED
│   │   └── composer.tsx                # fase 2
│   ├── contact-panel/
│   │   ├── contact-panel.tsx           # coluna 3, colapsável
│   │   └── window-countdown.tsx        # janela de 24h
│   └── inbox-shell.tsx                 # grid das 3 colunas + estados vazios
├── hooks/
│   ├── use-selected-conversation.ts    # nuqs: ?c=<id>
│   ├── use-conversation-filters.ts     # nuqs: status/priority/scope/q
│   ├── use-inbox-panels.ts             # zustand: 3ª coluna aberta
│   └── use-message-drafts.ts           # zustand: rascunho por conversa
└── lib/
    ├── format-message-time.ts
    └── merge-message-page.ts           # append + dedupe por waMessageId

app/(protected)/(general)/conversations/
├── page.tsx                        # server component: metadata + <InboxShell />
└── _components/client.tsx          # 'use client' fino, só monta o shell
```

**Por que módulo e não `_components/` plano:** são ~15 componentes com estado compartilhado
entre as 3 colunas. Um diretório plano com 15 arquivos não tem hierarquia que ajude a navegar.
`features/auth/` já estabeleceu o padrão no repo.

---

## 5. Estado

| Tipo | Onde | Conteúdo |
|---|---|---|
| URL (`nuqs`) | `?c=<id>&status=&priority=&scope=&q=` | conversa selecionada e filtros |
| Server (React Query) | client gerado | lista, thread, detalhe |
| Client (`zustand`) | `features/inbox/hooks` | rascunho por conversa, 3ª coluna aberta |

A conversa selecionada vive na **URL**, não em `useState`. É o que permite o gestor mandar um
link direto para o vendedor e o F5 não perder o lugar.

Rascunho por conversa é client-side e sobrevive à troca de conversa — o atendente alterna entre
três clientes e não pode perder o que digitou.

---

## 6. Realtime

### O que o backend precisa emitir (ainda não existe)

Hoje `emitRealtimeEvent` manda `{ entity, action, entityId }` sem corpo. A thread precisa de um
evento **com payload**:

```typescript
{
  entity: 'message',
  action: 'created',
  entityId: message.id,
  payload: { /* a mensagem, mesma forma do item de listMessages */ }
}
```

`ENTITY_INVALIDATION_TAGS` já foi estendido e está em produção:

```typescript
conversation: ['Conversations'],
message: ['Messages', 'Conversations'],
contact: ['Contacts'],
```

### Comportamento no cliente

| Situação | Ação |
|---|---|
| Thread aberta é a da mensagem | `setQueryData` na primeira página do infinite, append + **dedupe por `waMessageId`** |
| Lista de conversas | `invalidateByTags(['Conversations'])` — mecanismo atual |
| Thread não aberta | nada; refaz o fetch quando for aberta |

**Dedupe por `waMessageId` é obrigatório.** A mensagem que o próprio atendente enviou volta pelo
socket e duplicaria na tela. `waMessageId` é `nullable` enquanto a mensagem está `PENDING`, então
a chave de dedupe é `waMessageId ?? id`.

> **Nota de escala herdada do backend:** `emitRealtimeEvent` usa `io.emit()` — broadcast global.
> Um vendedor recebe evento de conversa que não pode ver e dispara um refetch inútil. Não é
> vazamento (o refetch passa pelo RBAC do servidor), é ruído. A migração para rooms está
> registrada no design de backend §6.6.

---

## 7. RBAC no cliente

**O cliente esconde controle; ele não protege dado.** O escopo real é o `scopeConversations` do
servidor, que já está implementado e aplicado nas três leituras.

| Role | Vê | Controles |
|---|---|---|
| `admin` | tudo (`scope=all`) | seletor de escopo, reatribuir, fechar, composer |
| `manager` | tudo (`scope=all`) | seletor de escopo, reatribuir, fechar, composer |
| `agent` | só as suas | composer, fechar |
| `viewer` | só as suas | **nenhum** — barra explicando somente leitura no lugar do composer |

Uso: `const { role, hasRole } = useUserRole()`.

Detalhe que decorre do §2: o `scope-selector` não é só um filtro de UI — ele é **necessário**
para admin/manager verem qualquer coisa, porque o default do servidor é `mine`.

---

## 8. Fases

| # | Entrega | Depende de |
|---|---|---|
| 1 | **Inbox leitura** — 3 colunas, lista + thread, filtros, estados vazios | ✅ **entregue** |
| 2 | **Inbox escrita** — composer, otimista, janela de 24h, reenvio | ✅ **entregue** |
| 3 | **Inbox gestão** — reatribuir, fechar, reabrir | pendente; marcar-lida já entregue |
| 4 | **Contatos** | ✅ **entregue** |
| 5 | **Distribuição + Equipes** | `routes/distribution/`, `routes/teams/` |
| 6 | **Relatórios** | `routes/reports/` |

Fases 1, 2 e 4 entregues. A fase 3 depende das rotas de atribuição, que ainda não existem.

**Iniciar conversa com número novo** (`POST /conversations/start` + dialog na coluna 1) entrou
junto com a fase 2. Só aceita **template**: número novo não tem `lastInboundAt`, logo está fora
da janela de 24h e texto livre falharia sempre. Ver §2.3.1 do design de backend para o
tratamento do nono dígito, que é o que impede o mesmo cliente de virar dois contatos.

### Fase 2 — o que já está decidido

- Envio otimista: mensagem entra como `PENDING` com id temporário, reconciliada pelo
  `waMessageId` da resposta.
- Falha vira bolha vermelha com "reenviar" — não toast, que some e leva a mensagem junto.
- Fora da janela: composer travado e seletor de template. A decisão vem de `canSendFreeText`,
  **calculado no servidor**. O front exibe a contagem regressiva a partir de `windowExpiresAt`,
  mas não recalcula a regra.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| `scope=mine` default esvazia a lista de admin/manager | Seletor manda `scope=all` desde a fase 1; documentado em §2 e §7 |
| Duplicata de mensagem no socket | Dedupe por `waMessageId ?? id` |
| Broadcast global gera refetch inútil | Aceitável agora; rooms quando o volume justificar |
| Offset na lista de conversas com reordenação constante | Lista reordena por `lastMessageAt`; se a paginação pular itens, migrar para cursor como já foi feito na thread |
| Contrato não exercitado com dados | Resolvido na fase 1: `apps/api/scripts/seed-inbox-demo.ts` semeia 5 conversas e 21 mensagens cobrindo os casos de borda (janela aberta/encerrada, `FAILED`, template, mídia, sem responsável, encerrada, múltiplos dias). Remover com `--clean`. Falta ainda o primeiro dado real vindo do webhook |

---

> Criado em 2026-07-31 10:54 (-03) · Última modificação: 2026-07-31 13:17 (-03)
