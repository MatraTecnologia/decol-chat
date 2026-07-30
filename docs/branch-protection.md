# Branch Protection — exigir o CI antes do merge

O workflow de CI (`.github/workflows/ci.yml`) roda `lint → typecheck → build → boundaries`
em todo push e pull request para `master`. Por padrão ele **mostra** ✅/❌ mas **não bloqueia**
merge de PR vermelho. Para transformá-lo em um portão de verdade, configure um branch ruleset
(ou branch protection) no GitHub.

> Este passo é **manual** (feito na UI do GitHub, não em código) e **opcional** — o CI já entrega
> o valor principal sem ele. Bloquear merges é o extra.

---

## ⚠️ Antes: enforcement em repo privado

Em uma **organização no plano free**, rulesets/branch protection **só são aplicados em repositórios
públicos**. Se o repo for **privado numa org free**, o ruleset pode ser criado mas **não é aplicado**
(o GitHub mostra o aviso: _"won't be enforced on this private repository until you upgrade to GitHub Team"_).

Para o bloqueio funcionar, escolha uma das opções:

- **Tornar o repositório público** (rulesets são gratuitos em repo público) — comum para um starter template.
- **Upgrade para GitHub Team / Enterprise** (pago).
- Criar mesmo assim como **informativo** (o check aparece no PR, mas não bloqueia).

---

## Passo a passo

**Settings → Rules → Rulesets → New branch ruleset**

1. **Ruleset Name**: ex. `Protect master`.
2. **Enforcement status**: mude de `Disabled` → **`Active`**.
3. **Target branches** → **Add target** → **"Include default branch"** (ou digite `master`).
   Sem isso a regra não vale para nenhum branch.
4. **Branch rules** → marque **"Require status checks to pass"**. No painel que abre:
   - **Add checks** e busque pelo job do CI: **`Lint · Typecheck · Build · Boundaries`**
     (o GitHub só lista o check depois que o CI rodou ao menos uma vez).
   - Recomendado marcar também **"Require branches to be up to date before merging"**.
5. Mantenha os defaults **Restrict deletions** e **Block force pushes**.
6. (Opcional, recomendado) marque **"Require a pull request before merging"** para adotar o fluxo por PR.
7. **Create**.

---

## Impacto no fluxo de trabalho

Exigir status check **bloqueia push direto na `master`** — a própria regra avisa
_"commits must first be pushed to another ref where the checks pass"_. Escolha o modelo:

- **Fluxo por PR (recomendado):** marque também **"Require a pull request before merging"**.
  Todo merge passa por PR e o CI gateia. É o padrão de qualidade esperado num starter público.
- **Manter push direto:** adicione seu usuário/role à **Bypass list** (botão **Add bypass**).
  A regra continua valendo para os demais; você ainda empurra direto em emergência.

---

## Resumo

| Item | Valor |
|------|-------|
| Workflow | `.github/workflows/ci.yml` |
| Check a exigir | `Lint · Typecheck · Build · Boundaries` |
| Branch alvo | `master` (default branch) |
| Requer plano | Repo **público** (free) ou **GitHub Team+** para repo privado |

> Criado em 2026-07-23 00:28 (-03) · Última modificação: 2026-07-23 00:28 (-03)
