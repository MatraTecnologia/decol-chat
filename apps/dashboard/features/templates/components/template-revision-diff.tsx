'use client'

import { cn } from '@workspace/ui/lib/utils'

type DiffKind = 'added' | 'removed' | 'changed'

interface DiffEntry {
  path: string
  kind: DiffKind
  before: string | null
  after: string | null
}

const flatten = (value: unknown, path: string, out: Map<string, string>) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, out))
    return
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, path ? `${path}.${key}` : key, out)
    }
    return
  }

  if (value === undefined) return

  out.set(path, String(value))
}

/** Chaves de asset privado nunca aparecem no diff — só o fato de terem mudado. */
const isPrivateAsset = (path: string) => path.endsWith('assetId')

const diffDefinitions = (before: unknown, after: unknown): DiffEntry[] => {
  const previous = new Map<string, string>()
  const current = new Map<string, string>()

  flatten(before, '', previous)
  flatten(after, '', current)

  const paths = [...new Set([...previous.keys(), ...current.keys()])].sort()
  const entries: DiffEntry[] = []

  for (const path of paths) {
    const from = previous.get(path)
    const to = current.get(path)

    if (from === to) continue

    if (from === undefined) {
      entries.push({ path, kind: 'added', before: null, after: to ?? null })
      continue
    }

    if (to === undefined) {
      entries.push({ path, kind: 'removed', before: from, after: null })
      continue
    }

    entries.push({ path, kind: 'changed', before: from, after: to })
  }

  return entries
}

const kindLabels: Record<DiffKind, string> = {
  added: 'Adicionado',
  removed: 'Removido',
  changed: 'Alterado',
}

const kindClasses: Record<DiffKind, string> = {
  added:
    'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400',
  removed: 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
  changed:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
}

const Value = ({ label, value }: { label: string; value: string | null }) => (
  <div className="min-w-0">
    <span className="text-muted-foreground text-xs">{label}: </span>
    <span className="text-xs break-words">{value ?? '--'}</span>
  </div>
)

interface TemplateRevisionDiffProps {
  before: unknown
  after: unknown
}

export const TemplateRevisionDiff = ({
  before,
  after,
}: TemplateRevisionDiffProps) => {
  const entries = diffDefinitions(before, after)

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Nenhuma diferença entre as revisões.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {entries.map(entry => {
        const redacted = isPrivateAsset(entry.path)

        return (
          <li key={entry.path} className="rounded-md border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium',
                  kindClasses[entry.kind],
                )}
              >
                {kindLabels[entry.kind]}
              </span>
              <code className="text-muted-foreground text-xs break-all">
                {entry.path}
              </code>
            </div>

            <div className="mt-1.5 space-y-0.5">
              {redacted ? (
                <p className="text-muted-foreground text-xs">
                  Mídia privada alterada — o conteúdo não é exibido aqui.
                </p>
              ) : (
                <>
                  {entry.kind !== 'added' && (
                    <Value label="Antes" value={entry.before} />
                  )}
                  {entry.kind !== 'removed' && (
                    <Value label="Depois" value={entry.after} />
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
