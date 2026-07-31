# Menu contextual da lista de conversas

## Objetivo

Permitir que o usuário abra, com o botão direito, um menu de ações sobre cada
conversa da Inbox. As ações disponíveis dependem da role e do estado atual da
conversa. Toda autorização é validada pela API; ocultar itens no dashboard é
somente uma conveniência de interface.

## Interface

Cada `ConversationItem` será o gatilho de um `ContextMenu` do pacote de UI já
existente. O clique normal continua selecionando a conversa. O clique direito
abre o menu sem trocar a seleção atual.

O menu mostra somente ações válidas para a role e para o estado do item:

- **Assumir conversa:** atribui a conversa ao próprio administrador;
- **Atribuir a outro:** abre um diálogo com usuários elegíveis;
- **Remover atribuição:** devolve a conversa à fila sem responsável;
- **Marcar como lida:** aparece quando `unreadCount` é maior que zero;
- **Prioridade:** submenu com baixa, média e alta, omitindo ou desabilitando o
  valor atual;
- **Encerrar:** aparece para conversas abertas ou pendentes;
- **Reabrir:** aparece para conversas encerradas.

Durante uma mutação, a ação correspondente fica desabilitada. Sucesso fecha o
menu e atualiza a lista; erro mantém o estado anterior e exibe um toast em
português. Conflito de atribuição informa que o responsável mudou e solicita
nova tentativa após a atualização dos dados.

## Permissões

| Ação | Admin | Manager | Agent | Viewer |
|---|---:|---:|---:|---:|
| Assumir | sim | sim | não | não |
| Atribuir a outro | sim | sim | não | não |
| Remover atribuição | sim | sim | não | não |
| Alterar prioridade | sim | sim | não | não |
| Marcar como lida | sim | sim | própria | não |
| Encerrar/reabrir | sim | sim | própria | não |

“Própria” significa uma conversa que permanece dentro do escopo RBAC do agent.
Uma tentativa fora desse escopo responde como não encontrada, sem revelar a
existência da conversa.

## API

As rotas seguem os padrões já documentados para o módulo de atendimento:

- `PATCH /conversations/:id` altera `priority`;
- `POST /conversations/:id/assign` atribui a conversa e recebe `userId` e
  `expectedAssigneeId`;
- `POST /conversations/:id/unassign` remove o responsável e recebe
  `expectedAssigneeId`;
- `POST /conversations/:id/read` reutiliza a rota existente;
- `POST /conversations/:id/close` encerra a conversa;
- `POST /conversations/:id/reopen` reabre a conversa.

As três ações de atribuição são autorizadas para `admin` e `manager`. A API
aceita como destino somente um usuário ativo com role `agent`. O campo
`expectedAssigneeId` fornece controle de concorrência: se o responsável atual
for diferente, a API responde `409 Conflict` sem sobrescrever a alteração feita
por outro administrador.

Encerrar grava `status: 'CLOSED'`, `closedAt` e `closedById`. Reabrir grava
`status: 'OPEN'` e limpa os campos de encerramento. Alterar prioridade aceita
somente `LOW`, `MEDIUM` ou `HIGH`.

Cada mutação devolve a conversa no formato de `conversationSchema` e emite um
evento `entity:mutated` para `conversation`, ação `updated`. Como as rotas e os
schemas mudam, o cliente OpenAPI será regenerado com a API saudável.

## Dashboard e dados

Um componente focado no menu recebe a conversa e a role atual. As mutações ficam
em um hook próprio, que usa o cliente gerado e centraliza estados pendentes,
mensagens de erro e invalidação das tags `Conversations`.

“Atribuir a outro” usa `GET /members`, disponível para administradores e gestores.
Essa resposta será estendida com o campo `banned`; o dashboard mostra somente
usuários com role `agent` e `banned !== true`, identificando claramente o
responsável atual. A API repete essa validação no momento da atribuição.

O próprio cliente recebe o evento Socket.io emitido pela API. A invalidação
local após sucesso garante resposta imediata; a invalidação em tempo real mantém
os demais clientes sincronizados.

## Testes e verificação

O backend terá cobertura para autorização por role, conversa fora do escopo,
atribuição bem-sucedida, usuário inelegível, conflito de responsável,
encerramento, reabertura e alteração de prioridade. O dashboard terá cobertura
da matriz de visibilidade e da escolha condicional entre encerrar e reabrir.

Também serão executados lint, typecheck, geração do cliente OpenAPI conforme o
workflow do repositório e build dos workspaces afetados.

## Fora do escopo

- atribuição automática ou round-robin;
- seleção de equipe;
- ações em lote;
- menu contextual no painel da thread;
- histórico visual de atribuições.
