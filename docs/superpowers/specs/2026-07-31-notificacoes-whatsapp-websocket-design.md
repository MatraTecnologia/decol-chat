# Notificações de mensagens do WhatsApp via WebSocket

## Objetivo

Exibir uma notificação nativa do navegador quando uma nova mensagem recebida do
WhatsApp chegar pelo Socket.io enquanto a guia do dashboard estiver aberta, mas
oculta. O recurso não entrega notificações com a guia ou o navegador fechados.

## Arquitetura

O backend continua emitindo o evento `entity:mutated` existente. Uma mensagem
recebida é identificada por `entity: 'message'`, `action: 'created'` e
`payload.direction: 'INBOUND'`. O payload já contém a mensagem persistida e o
`conversationId`, portanto não é necessário criar outro evento nem alterar a API.

No dashboard, um componente global montado dentro de `SocketProvider` mantém um
único listener para notificações. A atualização da thread e a invalidação do
React Query continuam em seus listeners atuais, com responsabilidades separadas.

## Permissão e interface

A permissão da Web Notifications API será solicitada somente após uma ação do
usuário. A sidebar mostrará o estado das notificações e permitirá solicitar a
permissão quando ela ainda estiver no estado `default`. O sistema não tenta
alterar uma permissão negada; nesse caso, informa que ela deve ser liberada nas
configurações do navegador.

O estado é derivado diretamente de `Notification.permission`. Navegadores sem
suporte à API exibem o recurso como indisponível, sem interromper o restante do
dashboard.

## Regras de exibição

Uma notificação será criada somente quando todas estas condições forem verdadeiras:

- o evento representa a criação de uma mensagem;
- a direção da mensagem é `INBOUND`;
- a permissão do navegador é `granted`;
- `document.visibilityState` não é `visible`.

O título será `Nova mensagem`. O corpo usará o texto recebido ou `Mídia recebida`
quando não houver conteúdo textual. A opção `tag` será baseada no
`conversationId`, substituindo a notificação anterior da mesma conversa.

Ao clicar, o dashboard chama `window.focus()`, navega para
`/conversations?c=<conversationId>` e fecha a notificação.

## Tratamento de erros

Ausência da Web Notifications API, permissão negada, payload incompleto e eventos
que não sejam mensagens recebidas são ignorados de forma segura. Uma falha ao
solicitar permissão não afeta a conexão Socket.io nem a Inbox.

## Verificação

A lógica de elegibilidade será isolada para permitir testes determinísticos dos
casos de mensagem recebida, mensagem enviada, guia visível, guia oculta e payload
incompleto. Também serão executados lint e typecheck do dashboard. A verificação
manual cobre concessão e negação da permissão, notificação com a guia oculta,
ausência de notificação com a guia visível e navegação ao clicar.

## Fora do escopo

- notificações com a guia ou o navegador fechados;
- service worker, Push API ou servidor de Web Push;
- novo evento Socket.io exclusivo para notificações;
- alteração do payload backend para incluir o nome do contato.
