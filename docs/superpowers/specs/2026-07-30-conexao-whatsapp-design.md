# Página `/conexao` — Bancada de integração WhatsApp Cloud API

## Objetivo

Uma página no dashboard que serve simultaneamente como **bancada de testes** e **manual completo** para integrar a WhatsApp Cloud API (Meta) ao sistema. Ela precisa provar o ciclo inteiro sem sair da tela: credencial válida → mensagem enviada → status de entrega voltando pelo webhook → aparecendo no console ao vivo.

## Escopo

Este documento cobre **apenas a Fase 1**.

### Fase 1 (esta spec)

Token manual → validação contra a Graph API → URL de webhook e verify token copiáveis → `GET`/`POST /webhooks/whatsapp` → log no Redis + console ao vivo → envio de mensagem de teste → health check → manual passo a passo na página.

### Fase 2 (fora de escopo, ciclo próprio depois)

Embedded Signup (`config_id`, troca do authorization code, descoberta automática de WABA/phone) e assinatura programática de webhook via `/{waba_id}/subscribed_apps`.

**Motivo do corte:** Embedded Signup exige um app configurado como Tech Provider com `config_id` aprovado pela Meta — dependência inteiramente fora do nosso controle. A Fase 1 funciona hoje e prova a integração ponta a ponta sozinha.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Produto Meta | WhatsApp Cloud API |
| Rota | `/conexao` — `app/(protected)/(general)/conexao/` |
| Cardinalidade | Uma conexão global (singleton), sem escopo por usuário |
| Credencial | Token manual (System User Token colado no formulário) |
| Logs | Redis com TTL + stream Socket.io |
| URL de webhook | Env `PUBLIC_WEBHOOK_BASE_URL` como padrão + campo de override na página |
| Link no sidebar | Sim, em `generalItems` |

## Restrição de ambiente (não é detalhe de implementação)

A Meta precisa alcançar o webhook por **HTTPS público**. `localhost:3333` é inalcançável. Sem um túnel (ngrok/cloudflared) **nada** funciona em dev: nem o handshake de verificação, nem a ingestão de eventos, nem o status de entrega da mensagem de teste.

Consequências no desenho:

- A URL exibida não pode ser derivada de `BETTER_AUTH_URL` em dev.
- A página mostra um alerta visível quando a base resolvida aponta para `localhost`/`127.0.0.1`.
- O campo de override existe porque a URL do ngrok gratuito muda a cada restart, e editar `.env` + reiniciar a API a cada vez é inviável.

CORS e `TRUSTED_ORIGINS` são irrelevantes para o webhook — o `POST` da Meta não é uma requisição de browser.

---

## Arquitetura

### Backend (`apps/api`)

```
src/
├── lib/whatsapp/
│   ├── graph-client.ts    # wrapper da Graph API (versão fixa, erro tipado)
│   ├── crypto.ts          # AES-256-GCM encrypt/decrypt
│   ├── connection.ts      # leitura/escrita do registro singleton + decrypt
│   ├── signature.ts       # HMAC X-Hub-Signature-256 sobre raw body
│   └── webhook-log.ts     # ring no Redis + emissão do evento de socket
├── routes/
│   ├── whatsapp/index.ts     # rotas administrativas (admin-only)
│   └── webhooks/whatsapp.ts  # GET + POST públicos
```

Cinco módulos pequenos com um propósito cada, em vez de um `whatsapp.ts` grande. `graph-client.ts` é o **único** que fala HTTP com a Meta; os demais não sabem que a Meta existe. Isso mantém cada arquivo testável isoladamente e pequeno o bastante para ser lido inteiro.

### Frontend (`apps/dashboard`)

```
app/(protected)/(general)/conexao/
├── page.tsx                    # server component: metadata + <Client />
├── _components/
│   ├── client.tsx              # orquestra o layout, sem lógica de rede
│   ├── credentials-form.tsx    # formulário de credenciais
│   ├── connection-status.tsx   # health check + estado atual
│   ├── webhook-panel.tsx       # URL + verify token copiáveis, override da base
│   ├── webhook-console.tsx     # log ao vivo, filtrável
│   ├── test-message-form.tsx   # envio de mensagem de teste
│   └── setup-guide.tsx         # manual passo a passo (texto estático)
└── _hooks/
    └── use-webhook-logs.ts     # histórico via API + stream via socket
```

`_hooks/` é justificado aqui: a rota tem estado de socket próprio, que não cabe inline em `client.tsx` (é a exceção prevista em `apps/dashboard/CLAUDE.md`).

---

## Dados

### Model Prisma

```prisma
model WhatsAppConnection {
  id                 String    @id @default("singleton")
  accessToken        String    // AES-256-GCM
  appSecret          String    // AES-256-GCM — necessário para validar o HMAC
  phoneNumberId      String
  wabaId             String
  verifyToken        String
  webhookBaseUrl     String?   // override do env
  displayPhoneNumber String?   // preenchido pelo health check
  verifiedName       String?
  qualityRating      String?
  lastCheckedAt      DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

Registro único com `id` fixo `"singleton"`. Sem `userId`, sem lista.

O **app secret fica no banco, não no env**, porque é dado da conexão: ele é o segredo do HMAC do webhook e muda junto com as demais credenciais quando você troca de app na Meta. Deixá-lo no env forçaria um restart da API a cada troca.

### Logs no Redis

- Chave: `whatsapp:webhook:logs`
- Escrita: `LPUSH` → `LTRIM 0 199` → `EXPIRE 86400`
- Entrada: `{ id, receivedAt, direction, signatureValid, summary, headers, payload }`

`direction` distingue as três coisas que aparecem no mesmo console:

| Valor | Origem |
|---|---|
| `inbound_verify` | Handshake `GET` da Meta |
| `inbound_event` | Eventos `POST` da Meta (mensagens, status de entrega) |
| `outbound` | Nossas chamadas à Graph API (envio de teste, health check) |

`summary` é uma linha curta derivada do payload (ex.: `message.status=delivered wamid=...`) para o console ser legível sem expandir o JSON.

### Realtime — dois canais distintos

| Canal | Uso |
|---|---|
| `whatsapp:webhook` (evento novo) | Stream de log. Empurra a entrada completa, sem refetch. |
| `entity:mutated` (existente) | Mudança de estado da conexão. Adicionar `whatsappConnection: ['WhatsApp']` em `ENTITY_INVALIDATION_TAGS`. |

Log **não** é invalidação de cache. Mandar log pelo `entity:mutated` faria a página refetchar a lista inteira a cada mensagem recebida — daí o evento próprio.

### Envs novas

Ambas **opcionais** no schema de `apps/api/src/env.ts`. Torná-las obrigatórias quebraria o boot de qualquer ambiente que não usa WhatsApp.

| Var | Default | Nota |
|---|---|---|
| `WHATSAPP_ENCRYPTION_KEY` | — | 32 bytes em base64. Ausente → as rotas de WhatsApp devolvem 503 com mensagem explicativa; a API sobe normalmente. |
| `PUBLIC_WEBHOOK_BASE_URL` | `BETTER_AUTH_URL` | Base da URL de webhook. O campo `webhookBaseUrl` da conexão sobrescreve quando preenchido. |

---

## Rotas da API

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/whatsapp` | admin | Estado + credenciais **mascaradas** |
| `PUT` | `/whatsapp` | admin | Salva/atualiza; valida contra a Graph API antes de gravar |
| `DELETE` | `/whatsapp` | admin | Remove a conexão |
| `GET` | `/whatsapp/health` | admin | `GET /{phone_number_id}` → nome exibido, número, qualidade, tier |
| `POST` | `/whatsapp/test-message` | admin | `POST /{phone_number_id}/messages` — texto livre ou template |
| `GET` | `/whatsapp/logs` | admin | Últimas 200 entradas do Redis (seed do console) |
| `GET` | `/webhooks/whatsapp` | **nenhuma** | Handshake de verificação |
| `POST` | `/webhooks/whatsapp` | **nenhuma** | Ingestão de eventos |

Swagger tag: `WhatsApp` para as rotas administrativas (casa com `ENTITY_INVALIDATION_TAGS`). O webhook usa tag `Webhooks`.

---

## Segurança

Cada item abaixo é um modo de falha conhecido, não uma precaução genérica.

### Webhook não tem guard de sessão — a assinatura É a autenticação

A Meta não manda cookie de sessão. Colocar `requireAuth` no webhook o quebra. A validação do HMAC `X-Hub-Signature-256` é o que autentica a requisição.

### HMAC precisa do raw body

O Fastify faz parse do JSON antes do handler. HMAC calculado sobre o objeto reserializado **nunca** bate com o da Meta. É necessário capturar o buffer cru — `addContentTypeParser` escopado à rota, ou hook `preParsing`. Este é o ponto mais provável de falhar silenciosamente.

Comparação com `crypto.timingSafeEqual`, não `===`.

### `GET` do webhook responde texto puro

O handshake exige `hub.challenge` devolvido **cru**, como `text/plain` — não JSON. O `serializerCompiler` global do Zod rejeita schema não-Zod (foi exatamente o bug que derrubou `/health/pressure` neste projeto). Solução: `serializerCompiler` próprio na rota, ou `reply.type('text/plain').send(challenge)`.

Também valida `hub.verify_token` contra o `verifyToken` da conexão; divergência → 403.

### Webhook isento de rate-limit e under-pressure

O limite global é 500/min e o `under-pressure` devolve 503 sob carga. A Meta reenvia em erro e **pode desativar a assinatura** após falhas repetidas. A rota precisa de `config.rateLimit: false` e ficar fora do caminho do under-pressure.

### `POST` do webhook responde 200 sempre

Fora assinatura inválida (401), qualquer erro de processamento ainda responde 200. O processamento é fire-and-forget: gravar no Redis e emitir o socket não podem atrasar nem derrubar a resposta à Meta.

### Segredos em repouso e em trânsito

- `accessToken` e `appSecret` cifrados com AES-256-GCM usando `WHATSAPP_ENCRYPTION_KEY`.
- **Nunca** retornados pela API. `GET /whatsapp/connection` devolve só os 4 últimos caracteres (`••••••1234`).
- O payload logado no Redis não inclui headers de autorização.

### `/conexao` é admin-only no servidor

O layout protegido só bloqueia `role === 'user'` — qualquer outro role passaria. Como a página guarda credenciais do sistema inteiro, todas as rotas administrativas usam `requireRole(request, ['admin'])`.

No frontend, a rota continua em `(general)`, mas: `page.tsx` envolve o conteúdo em `<AdminGate>`, e o item do sidebar ganha a flag `adminOnly` (filtrada em `renderGroup`) para não aparecer a não-admins. Isso é UX — **o guard real é na API**.

---

## Fluxo de dados

**Configuração**
```
credentials-form → PUT /whatsapp/connection
  → valida via Graph API (GET /{phone_number_id})
  → cifra token + app secret → grava singleton
  → emitRealtimeEvent(whatsappConnection/updated)
  → dashboard invalida tag 'WhatsApp' → status atualiza
```

**Ciclo de prova ponta a ponta**
```
test-message-form → POST /whatsapp/test-message
  → Graph API POST /{phone_number_id}/messages
  → log outbound no Redis + socket → console
                    ⋮
Meta → POST /webhooks/whatsapp (status: sent → delivered → read)
  → valida HMAC → log inbound_event → socket → console
```

O usuário vê as duas pontas do mesmo `wamid` no console. É isso que prova que a integração funciona.

**Por que o envio de teste aceita dois modos:** a Cloud API só entrega **texto livre** dentro da janela de 24h aberta pelo destinatário; fora dela responde `131047`. Pior: o `POST /messages` retorna 200 com `wamid` mesmo quando a mensagem vai falhar — `wamid` significa "aceito para processamento", não entrega. O resultado real (`sent`/`delivered`/`read`/`failed`) chega **exclusivamente** pelo webhook, e não existe endpoint de consulta de status. Por isso o formulário oferece também o modo **template** (`hello_world`/`en_US` existe em toda conta), que funciona com a janela fechada e permite provar o envio sem depender do destinatário escrever primeiro.

---

## Tratamento de erros

| Situação | Resposta |
|---|---|
| `WHATSAPP_ENCRYPTION_KEY` ausente | 503 com mensagem explicando qual env falta |
| Conexão não configurada | 404 nas rotas que exigem credencial |
| Graph API rejeita o token | 400 propagando `error.message` e `error.code` da Meta |
| Graph API fora do ar / timeout | 502 |
| Assinatura de webhook inválida | 401 + entrada de log com `signatureValid: false` |
| `hub.verify_token` divergente | 403 |
| Redis indisponível | Log é descartado silenciosamente (mesma postura de `lib/cache.ts`); o webhook ainda responde 200 |

Erros da Graph API são propagados com o texto original da Meta. Numa bancada de testes, mascarar a mensagem de erro real destrói justamente o valor da ferramenta.

---

## Verificação

Sem suíte de testes automatizados nesta fase — o projeto não tem uma hoje, e o valor da página está na verificação manual assistida.

**Verificação automática (final da implementação):**
- `pnpm typecheck` limpo em `@workspace/api` e `dashboard`.

**Verificação manual, na ordem:**
1. Subir túnel; colar a origem no campo de override.
2. Salvar credenciais → status vira "conectado" com nome e número corretos.
3. Health check → qualidade e tier aparecem.
4. Configurar o webhook no App Dashboard da Meta com a URL e o verify token copiados → o handshake aparece no console como `inbound_verify`.
5. Enviar mensagem de teste → entrada `outbound` no console; mensagem chega no celular.
6. Status de entrega volta como `inbound_event` em segundos.
7. Responder do celular → mensagem recebida aparece no console.
8. Adulterar o app secret → o próximo evento aparece com `signatureValid: false` e a rota retorna 401.

O passo 8 é o que confirma que a validação de assinatura está de fato ligada, e não passando por acidente.

---

## Notas de implementação

- Fixar a versão da Graph API numa constante única em `graph-client.ts` (`v25.0`), nunca espalhada pelas chamadas. A Meta descontinua versões com frequência e responde com o header `x-ad-api-version-warning` antes de cortar — vale conferir esse header ao depurar.
- Os nomes de parâmetro do fluxo de Embedded Signup **não** foram confirmados contra a doc atual da Meta — irrelevante para a Fase 1, mas deve ser verificado no início da Fase 2.
- `pnpm generate:api` precisa rodar depois das rotas existirem e com a API respondendo em `/health` (ver `CLAUDE.md` raiz).
- `pnpm db:push` para materializar o model — o projeto usa `db:push`, não migrations.

> Criado em 2026-07-30 18:11 (-03) · Última modificação: 2026-07-30 18:34 (-03)
