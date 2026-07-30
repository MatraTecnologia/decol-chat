# Commit hooks (husky + lint-staged) — proposta

> ⚠️ **Status: NÃO implementado — aguardando decisão.**
> Este documento registra a proposta e os trade-offs. Nada foi adicionado ao repo.

Adicionar hooks de `pre-commit` que formatam e lintam **só os arquivos staged** antes de
cada commit, para garantir que nada mal-formatado ou com lint quebrado seja commitado.

---

## O que seria

- **husky** — gerencia os git hooks (cria `.husky/`, aponta `core.hooksPath`); instala um `pre-commit`.
- **lint-staged** — roda comandos apenas nos arquivos **staged** (não o repo inteiro).

No commit, o `pre-commit` rodaria, nos `*.{ts,tsx}` staged:
- `prettier --write` (formata)
- `eslint --fix` (corrige o lint auto-fixável)

Um commit "sujo" nem sai — corrige na hora, localmente.

## Valor
- Formatação consistente garantida (acaba o "esqueci de rodar o prettier").
- Feedback mais rápido que o CI (local, antes do push).
- Menos CI vermelho por coisa trivial de format/lint.

## Custo / por que é opinativo
- Adiciona atrito — cada commit demora alguns segundos a mais.
- Contornável com `--no-verify` (aí perde o sentido).
- husky mexe no `core.hooksPath`, o que às vezes surpreende quem clona.
- **Redundante com o CI que já existe** (`.github/workflows/ci.yml` já gateia `lint/typecheck/build/boundaries` nos PRs). O ganho extra é só *auto-format local* + *feedback antes do push*.

Por isso alguns starters incluem (DX pronta) e outros deixam de fora de propósito (não atrasar o commit local; deixar o CI ser o portão).

## Alternativas de ferramenta
- **husky + lint-staged** — o combo mais comum/documentado (recomendado se for implementar).
- **lefthook** — moderno, rápido (binário Go), ótimo pra monorepo (tarefas em paralelo).
- **simple-git-hooks** — minimalista, quase sem dependência.

## Recomendação
É o item **menos crítico** do review de config — diferente do CI (gap real), aqui é conforto.
Como o CI já garante a **correção**, o hook agrega principalmente **auto-formatação no commit**.
Vale **se** o objetivo é que todo mundo commite sempre formatado sem pensar; se preferir commits
locais rápidos e deixar o CI cuidar, dá pra pular sem perda de qualidade.

---

## Se decidir implementar (esboço)

```bash
pnpm add -D -w husky lint-staged
pnpm exec husky init          # cria .husky/ + o script `prepare`
```

`.husky/pre-commit`:
```sh
pnpm exec lint-staged
```

`package.json` (raiz):
```jsonc
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

> Detalhe do monorepo: o `eslint --fix` roda por-arquivo; a config flat (`eslint.config.js`)
> de cada workspace é resolvida automaticamente pelo ESLint pelo caminho do arquivo.

---

> Criado em 2026-07-23 01:27 (-03) · Última modificação: 2026-07-23 01:27 (-03)
