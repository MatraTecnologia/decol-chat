# Renovate — atualização automática de dependências

O [Renovate](https://docs.renovatebot.com/) abre PRs de atualização de dependências
automaticamente. Aqui ele roda **self-hosted no próprio GitHub Actions** (grátis) — dispensa
o app pago do Mend. Cada PR passa pelo CI (`.github/workflows/ci.yml`), então uma atualização
que quebra `lint/typecheck/build/boundaries` nunca chega verde.

**Arquivos:**
- `.github/workflows/renovate.yml` — roda o Renovate semanalmente (segunda 05:00 UTC) + manual (`workflow_dispatch`)
- `renovate.json` — como as atualizações são feitas (agrupamento, cooldown, pins)

---

## ⚙️ Setup (manual, uma vez)

O workflow precisa de um token para o Renovate criar branches/PRs. Deve ser um **PAT**
(não o `GITHUB_TOKEN`) — só assim os PRs do Renovate disparam o workflow de CI.

### 1. Criar um fine-grained PAT

**GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token:**

- **Token name:** `renovate-turborepo-saas-starter`
- **Resource owner:** a org dona do repo (ex.: `MatraTecnologia`)
- **Repository access:** *Only select repositories* → o repo (`turborepo-saas-starter`)
- **Repository permissions:**
  - **Contents:** Read and write
  - **Pull requests:** Read and write
  - **Issues:** Read and write *(para o Dependency Dashboard)*
  - **Workflows:** Read and write *(para o Renovate atualizar os workflows / digests de actions)*
  - Metadata: Read-only *(marca sozinho)*
- **Generate** → copie o token (só aparece uma vez).

> Se a org tiver aprovação de PAT ligada, o **owner da org precisa aprovar** o token.
> Alternativa mais ampla (menos ideal): PAT clássico com escopos `repo` + `workflow`.

### 2. Adicionar o secret

**Repo → Settings → Secrets and variables → Actions → New repository secret:**
- **Name:** `RENOVATE_TOKEN`
- **Secret:** cole o token

### 3. Testar

**Repo → Actions → workflow "Renovate" → Run workflow.** No primeiro run o Renovate:
- abre um PR de onboarding *(pulado se o `renovate.json` já existe)*
- cria a issue **"Dependency Dashboard"** (lista tudo que ele vai/pode atualizar)
- passa a rodar toda segunda de manhã

---

## O que está configurado (`renovate.json`)

| Item | Comportamento |
|------|---------------|
| `minimumReleaseAge: "3 days"` | Espelha o `pnpm-workspace.yaml` — só propõe versões já instaláveis (não pinga release recém-lançado) |
| Agrupamento | Todos os **patch + minor num PR único semanal** ("non-major dependencies"); **majors separados** (revisar 1 a 1) |
| `helpers:pinGitHubActionDigests` | Pina e mantém os digests de **todas** as GitHub Actions (supply-chain) |
| `lockFileMaintenance` | Recria o lockfile periodicamente |
| Pins deliberados | `typescript < 7` (7.x quebra typescript-eslint + tsc-alias) · `@types/node < 23` (casa com Node 22) |
| **Sem automerge** | O repo não tem suíte de testes (o CI cobre só build-time), então um humano revisa o PR semanal já CI-green |

---

## Fluxo semanal

1. Segunda 05:00 UTC o workflow roda o Renovate.
2. Ele abre/atualiza o PR **"non-major dependencies"** (e PRs separados para cada major).
3. O **CI roda em cada PR** → verde = seguro mergear; vermelho = a atualização quebra algo (não mergeie).
4. Você revisa e faz merge (ou fecha um PR que não quer — o Renovate respeita o fechamento e propõe a próxima versão depois).
5. A issue **Dependency Dashboard** é o painel de tudo que está pendente/retido.

> **Dica:** ao fechar um PR de atualização sem mergear (ex.: uma versão regressiva),
> o Renovate **retém aquela versão** e só propõe a próxima — útil para segurar um patch com bug
> até uma versão corrigida.

---

## Referências
- [`.github/workflows/renovate.yml`](../.github/workflows/renovate.yml) · [`renovate.json`](../renovate.json)
- [Renovate docs](https://docs.renovatebot.com/) · [config options](https://docs.renovatebot.com/configuration-options/)

> Criado em 2026-07-23 01:20 (-03) · Última modificação: 2026-07-23 01:20 (-03)
