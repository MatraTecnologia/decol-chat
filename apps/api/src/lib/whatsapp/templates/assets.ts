/**
 * Ciclo de vida da mídia de exemplo dos modelos.
 *
 * O arquivo mora no bucket privado e a chave nunca sai da API: o navegador só
 * enxerga URL assinada de curta duração. O handle da Meta é derivado do objeto
 * já confirmado e reaproveitado enquanto ele não mudar.
 *
 * Fachada do módulo puro `asset-rules.ts` — é este arquivo que o resto da API
 * deve importar; o runner de teste carrega o outro.
 */
import { prisma } from '@/lib/prisma.js'

import {
  R2_PRIVATE_BUCKET,
  getDownloadUrl,
  getFile,
  getUploadUrl,
  headFile,
} from '@/lib/storage.js'

import { generateId } from '@/utils/generate-id.js'

import type { DecryptedAccount } from '../connection.js'

import {
  GraphApiError,
  createUploadSession,
  uploadSessionFile,
} from '../graph-client.js'

import {
  buildAssetObjectKey,
  matchesUploadedSize,
  shouldReuseMetaHandle,
  validateTemplateAsset,
} from './asset-rules.js'

import type { TemplateResult } from './results.js'
import { conflict, invalid, notFound, ok, remoteError } from './results.js'

export {
  TEMPLATE_ASSET_RULES,
  buildAssetObjectKey,
  findAssetRule,
  isSafeAssetSegment,
  matchesUploadedSize,
  shouldReuseMetaHandle,
  validateTemplateAsset,
  type TemplateAssetKind,
} from './asset-rules.js'

/** URL assinada curta: o navegador usa na hora, ninguém guarda o link. */
const SIGNED_URL_TTL_SECONDS = 300

const MISSING_APP_ID =
  'Informe o App ID na conexão do WhatsApp para enviar mídias aos modelos.'

const findAccountAsset = (accountId: string, assetId: string) =>
  prisma.whatsAppTemplateAsset.findFirst({
    where: { id: assetId, whatsAppAccountId: accountId },
  })

export interface PrepareAssetUploadInput {
  accountId: string
  revisionId: string
  fileName: string
  mimeType: string
  byteSize: number
}

export interface PreparedAssetUpload {
  assetId: string
  kind: string
  uploadUrl: string
  expiresIn: number
}

export const prepareAssetUpload = async (
  input: PrepareAssetUploadInput,
): Promise<TemplateResult<PreparedAssetUpload>> => {
  const validation = validateTemplateAsset(input)
  if (!validation.ok) return invalid(validation.message)

  const revision = await prisma.whatsAppTemplateRevision.findFirst({
    where: {
      id: input.revisionId,
      template: { whatsAppAccountId: input.accountId },
    },
    select: { id: true, state: true },
  })
  if (!revision) return notFound()

  // Revisão enviada é imutável: trocar a mídia dela mudaria o que a Meta
  // aprovou sem passar por um novo envio.
  if (revision.state !== 'DRAFT') {
    return conflict('Esta revisão já foi enviada e não aceita nova mídia.')
  }

  const assetId = generateId()
  const objectKey = buildAssetObjectKey({
    accountId: input.accountId,
    revisionId: revision.id,
    assetId,
  })
  if (!objectKey)
    return invalid('Não foi possível montar o destino do arquivo.')

  await prisma.whatsAppTemplateAsset.create({
    data: {
      id: assetId,
      revisionId: revision.id,
      whatsAppAccountId: input.accountId,
      objectKey,
      originalName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      kind: validation.data.kind,
    },
  })

  const uploadUrl = await getUploadUrl(R2_PRIVATE_BUCKET, objectKey, {
    contentLength: input.byteSize,
    contentType: input.mimeType,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  })

  return ok({
    assetId,
    kind: validation.data.kind,
    uploadUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  })
}

export interface ConfirmedAsset {
  assetId: string
  kind: string
  mimeType: string
  byteSize: number
}

/**
 * Confere no bucket o que foi anunciado no `prepare`. O handle antigo é
 * descartado aqui: o objeto mudou, o handle da Meta não vale mais.
 */
export const confirmAssetUpload = async (
  accountId: string,
  assetId: string,
): Promise<TemplateResult<ConfirmedAsset>> => {
  const asset = await findAccountAsset(accountId, assetId)
  if (!asset) return notFound()

  let contentLength: number | null = null
  try {
    contentLength = (await headFile(R2_PRIVATE_BUCKET, asset.objectKey))
      .contentLength
  } catch {
    contentLength = null
  }

  const size = matchesUploadedSize(asset.byteSize, contentLength)
  if (!size.ok) return invalid(size.message)

  await prisma.whatsAppTemplateAsset.update({
    where: { id: asset.id },
    data: { metaHandle: null },
  })

  return ok({
    assetId: asset.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
  })
}

export interface MetaUploadHandle {
  assetId: string
  metaHandle: string
  reused: boolean
}

/**
 * Converte o objeto privado no handle que o payload do template exige. Sem
 * `appId` na conta ativa não há sessão de upload possível — o pedido volta como
 * inválido para a página pedir o dado que falta.
 */
export const ensureMetaUploadHandle = async (
  account: DecryptedAccount,
  assetId: string,
): Promise<TemplateResult<MetaUploadHandle>> => {
  const asset = await findAccountAsset(account.id, assetId)
  if (!asset) return notFound()

  if (shouldReuseMetaHandle(asset)) {
    return ok({ assetId: asset.id, metaHandle: asset.metaHandle, reused: true })
  }

  if (!account.appId) return invalid(MISSING_APP_ID)

  try {
    const file = await getFile(R2_PRIVATE_BUCKET, asset.objectKey)

    const session = await createUploadSession(
      account.accessToken,
      account.appId,
      {
        fileName: asset.originalName,
        fileLength: file.byteLength,
        fileType: asset.mimeType,
      },
    )

    const { h } = await uploadSessionFile(account.accessToken, session.id, file)

    await prisma.whatsAppTemplateAsset.update({
      where: { id: asset.id },
      data: { metaHandle: h },
    })

    return ok({ assetId: asset.id, metaHandle: h, reused: false })
  } catch (error) {
    if (!(error instanceof GraphApiError)) throw error

    return remoteError(error.message, error.status)
  }
}

export const getAssetPreviewUrl = async (
  accountId: string,
  assetId: string,
): Promise<TemplateResult<{ url: string; expiresIn: number }>> => {
  const asset = await findAccountAsset(accountId, assetId)
  if (!asset) return notFound()

  const url = await getDownloadUrl(
    R2_PRIVATE_BUCKET,
    asset.objectKey,
    SIGNED_URL_TTL_SECONDS,
  )

  return ok({ url, expiresIn: SIGNED_URL_TTL_SECONDS })
}
