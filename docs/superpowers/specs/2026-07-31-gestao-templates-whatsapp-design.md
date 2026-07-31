# Gestão de templates do WhatsApp

## Objetivo

Adicionar ao dashboard uma área completa para consultar, criar, editar, duplicar,
versionar e enviar templates de mensagem do WhatsApp para aprovação da Meta. A
solução deve manter rascunhos locais sem modificar acidentalmente um template em
produção, sincronizar o estado remoto da WABA e disponibilizar os templates
aprovados nos fluxos de envio de mensagem e criação de conversa.

A primeira interface opera sobre a conta WhatsApp ativa. A persistência e os
serviços ficam associados a `whatsAppAccountId`, permitindo evoluir para seleção
de múltiplas contas sem remodelar os dados.

## Abordagem escolhida

Será adotado um catálogo híbrido:

- o banco local mantém o catálogo, os rascunhos, as revisões e a auditoria;
- a Meta continua sendo a fonte de verdade para aprovação, qualidade e estado
  operacional;
- o envio à Meta acontece somente por uma ação explícita;
- a sincronização atualiza o retrato remoto sem sobrescrever um rascunho local;
- alterações de um template já enviado criam uma nova revisão editável.

Uma integração direta, sem persistência local, não atenderia ao histórico e aos
rascunhos. Um catálogo exclusivamente local poderia divergir silenciosamente da
WABA. O modelo híbrido preserva segurança editorial e consistência operacional.

## Permissões

As permissões seguem os papéis já existentes na aplicação:

| Ação | Admin | Gestor | Agente | Viewer |
| --- | --- | --- | --- | --- |
| Consultar templates | Sim | Sim | Sim | Sim |
| Usar um template aprovado | Sim | Sim | Sim | Não |
| Criar ou editar rascunhos | Sim | Sim | Não | Não |
| Duplicar templates | Sim | Sim | Não | Não |
| Enviar para aprovação | Sim | Sim | Não | Não |
| Excluir rascunho ou template remoto | Sim | Sim | Não | Não |
| Sincronizar com a Meta | Sim | Sim | Não | Não |

As regras serão aplicadas tanto na interface quanto no backend. Ocultar um botão
não substitui a autorização da rota. Agentes e viewers recebem respostas de
somente leitura mesmo que chamem a API diretamente.

## Navegação e catálogo

A sidebar terá o item **Templates**, visível a todos os papéis autenticados. A
página `/templates` exibirá:

- nome, idioma, categoria, estado, qualidade e última sincronização;
- busca por nome e filtros por idioma, categoria e estado;
- indicadores distintos para rascunho local e versão publicada na Meta;
- paginação e estados de carregamento, vazio e erro;
- ações de visualizar, editar, duplicar, sincronizar e excluir conforme o papel;
- botão para criar um template;
- sincronização manual e atualização automática após submissões pendentes.

O catálogo não apagará rascunhos quando um item deixar de aparecer na Meta. Essa
situação será sinalizada como divergência para que admin ou gestor decida como
proceder.

## Editor

O editor será guiado por blocos e terá pré-visualização semelhante ao WhatsApp.
Ele cobre as categorias de marketing, utilidade e autenticação e representa os
componentes como uma união discriminada validada no frontend e no backend.

O construtor contemplará:

- cabeçalhos de texto, imagem, vídeo, documento e localização;
- corpo, rodapé, exemplos e parâmetros posicionais ou nomeados;
- respostas rápidas;
- botões de URL estática ou dinâmica e chamada telefônica;
- botões de copiar código, código promocional e OTP;
- catálogo, produto e mensagem de vários produtos;
- WhatsApp Flows;
- carrossel e os componentes válidos de cada cartão;
- oferta por tempo limitado e demais propriedades aceitas pela versão utilizada
  da Graph API.

Regras dependentes de categoria serão refletidas no formulário. Por exemplo,
templates de autenticação usam o fluxo próprio de OTP e não apresentam todos os
blocos de marketing. Cada parâmetro exigirá exemplo antes da submissão quando a
Meta assim exigir.

Como a API da Meta evolui com frequência, haverá um modo avançado de JSON. Ele
usará o mesmo esquema base, mostrará erros de validação e permitirá preservar
campos ainda não expostos pelo editor visual. O JSON nunca poderá alterar campos
de identidade, conta, autoria ou estado de aprovação.

## Mídia

Arquivos usados por cabeçalhos e cartões serão enviados ao armazenamento privado
já utilizado pelo backend. O dashboard obterá uma URL assinada, e o backend
validará tipo, extensão e tamanho. No momento da submissão, o serviço converte o
arquivo armazenado no identificador ou handle exigido pela Meta.

O token da conta WhatsApp nunca será enviado ao navegador. Pré-visualizações
usarão URLs assinadas de curta duração. Arquivos órfãos serão eliminados por uma
rotina de manutenção, nunca como efeito colateral de uma sincronização.

## Persistência e versionamento

O domínio terá duas entidades principais:

### Template

Representa a identidade local e o retrato remoto. Armazena, no mínimo:

- conta WhatsApp, nome, idioma e categoria;
- ID remoto, quando existir;
- estado e qualidade retornados pela Meta;
- motivo de rejeição e datas de sincronização;
- payload remoto bruto para compatibilidade e diagnóstico;
- autoria e datas de criação e atualização.

A combinação conta, nome e idioma será única no catálogo local.

### Revisão

Representa uma versão imutável do conteúdo. Armazena, no mínimo:

- número sequencial da versão;
- componentes e formato dos parâmetros;
- estado local (`DRAFT`, `SUBMITTED` ou `SUPERSEDED`);
- autor e data;
- responsável, data e resposta da submissão;
- snapshot do payload efetivamente enviado.

Salvar durante a edição atualiza apenas o rascunho corrente. Uma submissão sela a
revisão, e qualquer edição posterior cria uma nova revisão. O histórico permite
comparar versões e duplicar uma versão antiga, mas não reescrever fatos já
submetidos.

## Estados e sincronização

O estado editorial local e o estado remoto serão armazenados separadamente. Isso
evita representar um template aprovado com alterações não submetidas como se já
estivesse publicado.

O adaptador da Graph API deverá normalizar os estados conhecidos, incluindo
pendente, aprovado, rejeitado, pausado e desabilitado, mas preservar o valor bruto
quando a Meta introduzir um estado novo. A qualidade seguirá a mesma estratégia.

A sincronização:

1. busca os templates da conta ativa com paginação da Graph API;
2. faz upsert pela identidade remota e por conta/nome/idioma quando necessário;
3. atualiza apenas o retrato remoto;
4. registra falhas parciais e a hora da última tentativa;
5. não altera nem remove revisões locais;
6. invalida as consultas do dashboard após conclusão.

Após uma submissão, o item assume o estado remoto devolvido pela Meta, normalmente
pendente, e será atualizado por sincronização periódica enquanto não chegar a um
estado estável. Webhooks de status poderão substituir o polling futuramente, sem
mudar o domínio.

## Operações da API

O backend oferecerá operações autenticadas para:

- listar e detalhar templates;
- criar, salvar e duplicar rascunhos;
- consultar o histórico e comparar revisões;
- preparar upload de mídia e confirmar o arquivo;
- validar uma revisão sem submetê-la;
- enviar uma revisão para criação ou atualização na Meta;
- sincronizar o catálogo;
- excluir somente um rascunho local;
- excluir um template remoto e refletir o resultado localmente.

Criação e atualização remotas serão encapsuladas no cliente da Graph API. As
rotas traduzirão erros da Meta para códigos estáveis da aplicação, preservando o
request ID remoto no log para suporte sem expor token ou conteúdo sensível.

Submissões usarão uma chave de idempotência local por revisão. Cliques repetidos
ou retries não poderão criar múltiplos templates. Atualizações concorrentes de
rascunho usarão versão ou `updatedAt` para detectar conflito, em vez de aceitar
silenciosamente a última gravação.

## Exclusão

Existem duas ações diferentes:

- **Excluir rascunho:** remove apenas conteúdo local nunca submetido;
- **Excluir na Meta:** executa a operação remota e só então atualiza o catálogo.

Ambas exigem confirmação explícita. A segunda informa nome, idioma e impacto. Se
a exclusão remota falhar, o registro local permanece intacto e mostra o erro. O
histórico de submissões e a trilha de auditoria não são apagados.

## Integração com envio de mensagens

Os diálogos atuais de template na conversa e em nova conversa deixarão de exigir
que o usuário digite nome e idioma manualmente. Eles passarão a:

- listar somente templates aprovados da conta ativa;
- permitir busca e seleção;
- montar dinamicamente os campos para parâmetros, mídia e botões;
- validar todos os valores antes do envio;
- exibir a pré-visualização final;
- enviar o nome, idioma e componentes compatíveis com a versão aprovada.

Admin, gestor e agente podem realizar o envio conforme as permissões gerais de
conversa. Viewer continua sem permissão de envio.

## Experiência de erro e recuperação

Erros de validação serão exibidos junto ao bloco correspondente. Erros remotos
manterão o rascunho salvo e apresentarão uma mensagem acionável, sem perder os
detalhes preenchidos. Expiração de sessão, falta de conexão ativa, rate limit,
arquivo incompatível, conflito de edição e indisponibilidade da Meta terão
tratamentos distintos.

Uma sincronização parcial não será apresentada como sucesso completo. O usuário
poderá tentar novamente, e operações idempotentes evitarão duplicidade.

## Segurança e observabilidade

- tokens descriptografados permanecem apenas no backend e não entram em logs;
- payloads e nomes são sanitizados antes de logs estruturados;
- uploads são privados, limitados e validados;
- todas as mutações registram usuário, conta, template, revisão e resultado;
- métricas distinguem sincronização, validação, submissão, atualização e exclusão;
- falhas da Graph API guardam código e request ID, respeitando a política de dados.

## Estratégia de testes

### Unidade

- validação dos componentes e regras por categoria;
- conversão do modelo local para payload da Graph API e conversão inversa;
- normalização de estados e qualidade desconhecidos;
- autorização por papel;
- transições de revisão e idempotência.

### Integração da API

- CRUD de rascunhos e conflito de edição;
- submissão de criação e atualização com cliente Meta simulado;
- sincronização paginada sem sobrescrever rascunhos;
- uploads e validação de mídia;
- exclusão local e remota;
- bloqueio de mutações para agente e viewer.

### Dashboard

- catálogo, filtros e estados;
- editor visual e JSON avançado;
- pré-visualização e parâmetros;
- permissões e confirmações destrutivas;
- seleção e envio de template aprovado em conversa nova e existente.

### Verificação de contrato

Serão executados geração do cliente, testes, lint, typecheck, build e verificação
das fronteiras do monorepo. Um teste manual em WABA de desenvolvimento cobrirá o
ciclo rascunho, submissão, aprovação ou rejeição simulada/sincronizada e envio.

## Entrega incremental

A implementação será dividida em fatias verificáveis, mantendo o desenho final:

1. domínio, migração, RBAC, catálogo e sincronização;
2. rascunhos, revisões, editor padrão e pré-visualização;
3. mídia e componentes especializados;
4. submissão, atualização, estados e exclusão remota;
5. integração dos aprovados com os dois fluxos de envio;
6. endurecimento, auditoria e verificação completa.

O modo avançado reduz o risco de bloquear componentes recém-adicionados pela Meta,
mas não elimina a necessidade de validar o payload no backend antes da submissão.

## Fora do escopo inicial

- seleção simultânea de várias contas na mesma tela;
- criação de WhatsApp Flows completos dentro do dashboard — o template apenas
  referencia um Flow já existente;
- recurso de apelação de rejeição;
- tradução automática entre idiomas;
- aprovação interna em múltiplas etapas antes do envio à Meta;
- substituição da fonte de verdade da Meta para status e qualidade.

## Referência técnica

A integração seguirá a coleção oficial da Meta para a WhatsApp Business
Management API, especialmente as operações de criação e exclusão em
`/{waba-id}/message_templates`. A versão da Graph API continuará centralizada no
cliente existente para permitir atualização controlada:

- [Meta — WhatsApp Business Management API](https://www.postman.com/meta/whatsapp-business-platform/documentation/3kru5r6/moved-whatsapp-business-management-api?entity=request-13382743-9e1e3840-5e65-476d-a496-bfe6d574c63c)
