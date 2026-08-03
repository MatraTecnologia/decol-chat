'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  confirmWhatsappTemplateAssetUploadMutation,
  getWhatsappTemplateAssetPreviewOptions,
  prepareWhatsappTemplateAssetUploadMutation,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import { Progress } from '@workspace/ui/components/progress'

import { FieldError } from './body-editor'

type MediaFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT'

const accepts: Record<MediaFormat, string> = {
  IMAGE: 'image/jpeg,image/png',
  VIDEO: 'video/mp4,video/3gpp',
  DOCUMENT: 'application/pdf',
}

const labels: Record<MediaFormat, string> = {
  IMAGE: 'Imagem de exemplo',
  VIDEO: 'Vídeo de exemplo',
  DOCUMENT: 'Documento de exemplo',
}

/**
 * A URL assinada inclui `Content-Type` e tamanho — o PUT tem que repetir os
 * mesmos valores, senão o R2 recusa. `XMLHttpRequest` por causa do progresso.
 */
const putSignedFile = (url: string, file: File, onProgress: (p: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open('PUT', url)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Falha no envio (HTTP ${request.status}).`))
    request.onerror = () => reject(new Error('Falha de rede durante o envio.'))
    request.send(file)
  })

interface TemplateMediaFieldProps {
  format: MediaFormat
  assetId?: string
  revisionId: string | null
  disabled: boolean
  onChange: (assetId: string | undefined) => void
  error?: string
}

export const TemplateMediaField = ({
  format,
  assetId,
  revisionId,
  disabled,
  onChange,
  error,
}: TemplateMediaFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const prepare = useMutation(prepareWhatsappTemplateAssetUploadMutation())
  const confirm = useMutation(confirmWhatsappTemplateAssetUploadMutation())

  const preview = useQuery({
    ...getWhatsappTemplateAssetPreviewOptions({
      path: { assetId: assetId ?? '' },
    }),
    enabled: Boolean(assetId),
  })

  const upload = async (file: File) => {
    if (!revisionId) return

    setFailure(null)
    setProgress(0)

    try {
      const prepared = await prepare.mutateAsync({
        body: {
          revisionId,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
        },
      })

      await putSignedFile(prepared.uploadUrl, file, setProgress)
      await confirm.mutateAsync({ path: { assetId: prepared.assetId } })

      onChange(prepared.assetId)
    } catch (uploadError) {
      const message = (uploadError as { message?: unknown } | null)?.message
      setFailure(
        typeof message === 'string' && message
          ? message
          : 'Não foi possível enviar o arquivo.',
      )
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const isBusy = progress !== null || prepare.isPending || confirm.isPending

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{labels[format]}</Label>

      {!revisionId ? (
        <p className="text-muted-foreground text-xs">
          Salve o rascunho antes de enviar a mídia de exemplo.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accepts[format]}
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isBusy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {assetId ? 'Substituir arquivo' : 'Enviar arquivo'}
            </Button>

            {assetId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isBusy}
                onClick={() => onChange(undefined)}
              >
                <X className="size-4" />
                Remover
              </Button>
            )}
          </div>

          {progress !== null && <Progress value={progress} />}
        </>
      )}

      {assetId && preview.data?.url && (
        <div className="overflow-hidden rounded-md border">
          {format === 'IMAGE' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.data.url}
              alt="Mídia de exemplo do modelo"
              className="max-h-40 w-full object-cover"
            />
          )}
          {format === 'VIDEO' && (
            <video src={preview.data.url} controls className="max-h-40 w-full" />
          )}
          {format === 'DOCUMENT' && (
            <a
              href={preview.data.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-3 text-xs underline"
            >
              <FileText className="size-4" />
              Abrir documento enviado
            </a>
          )}
        </div>
      )}

      <FieldError message={failure ?? error} />
    </div>
  )
}
