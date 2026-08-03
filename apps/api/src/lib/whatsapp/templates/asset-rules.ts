/**
 * Regras da mídia de template — puras de propósito.
 *
 * O `node --test` carrega este módulo direto, então nada aqui pode importar o
 * alias `@/` nem um relativo com extensão `.js` (o runner não reescreve para
 * `.ts`). O lado impuro do ciclo de upload vive em `assets.ts`.
 */
export type TemplateAssetKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export interface TemplateAssetRule {
  kind: TemplateAssetKind
  mimeTypes: string[]
  maxBytes: number
}

const MEGABYTE = 1024 * 1024

/** Limites da Meta para mídia de exemplo do template. */
export const TEMPLATE_ASSET_RULES: TemplateAssetRule[] = [
  {
    kind: 'IMAGE',
    mimeTypes: ['image/jpeg', 'image/png'],
    maxBytes: 5 * MEGABYTE,
  },
  {
    kind: 'VIDEO',
    mimeTypes: ['video/mp4', 'video/3gpp'],
    maxBytes: 16 * MEGABYTE,
  },
  {
    kind: 'DOCUMENT',
    mimeTypes: ['application/pdf'],
    maxBytes: 100 * MEGABYTE,
  },
]

export type AssetCheck<T> = { ok: true; data: T } | { ok: false; message: string }

const rejected = (message: string) => ({ ok: false as const, message })

const accepted = <T>(data: T) => ({ ok: true as const, data })

export const findAssetRule = (mimeType: string) =>
  TEMPLATE_ASSET_RULES.find(rule =>
    rule.mimeTypes.includes(mimeType.toLowerCase()),
  ) ?? null

export interface TemplateAssetInput {
  mimeType: string
  byteSize: number
}

export const validateTemplateAsset = (
  input: TemplateAssetInput,
): AssetCheck<{ kind: TemplateAssetKind; maxBytes: number }> => {
  const rule = findAssetRule(input.mimeType)
  if (!rule) {
    return rejected(`O tipo de arquivo "${input.mimeType}" não é aceito.`)
  }

  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) {
    return rejected('O tamanho do arquivo é inválido.')
  }

  if (input.byteSize > rule.maxBytes) {
    const limit = Math.floor(rule.maxBytes / MEGABYTE)

    return rejected(`O arquivo passa do limite de ${limit} MB para este tipo.`)
  }

  return accepted({ kind: rule.kind, maxBytes: rule.maxBytes })
}

/** Só id gerado pelo servidor entra na chave — nada vindo do nome do arquivo. */
export const isSafeAssetSegment = (value: string) => /^[a-z0-9]+$/i.test(value)

export interface AssetKeyInput {
  accountId: string
  revisionId: string
  assetId: string
}

/** Devolve `null` quando algum id não é seguro para virar caminho. */
export const buildAssetObjectKey = (input: AssetKeyInput) => {
  const segments = [input.accountId, input.revisionId, input.assetId]
  if (!segments.every(isSafeAssetSegment)) return null

  return `whatsapp-templates/${segments.join('/')}`
}

/** O objeto assinado pode nunca ter chegado — 0 byte conta como ausente. */
export const matchesUploadedSize = (
  expected: number,
  contentLength: number | null | undefined,
): AssetCheck<{ byteSize: number }> => {
  if (!contentLength) {
    return rejected('O arquivo não chegou ao armazenamento. Envie novamente.')
  }

  if (contentLength !== expected) {
    return rejected(
      `O arquivo enviado tem ${contentLength} bytes, mas ${expected} foram anunciados.`,
    )
  }

  return accepted({ byteSize: contentLength })
}

/** O handle da Meta vale enquanto o objeto no bucket não mudar. */
export const shouldReuseMetaHandle = <T extends { metaHandle?: string | null }>(
  asset: T,
): asset is T & { metaHandle: string } => Boolean(asset.metaHandle)
