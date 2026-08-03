'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  getWhatsappTemplateOptions,
  listWhatsappTemplateRevisionsOptions,
} from '@workspace/api-client/react-query'
import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  buildSendParameters,
  getTemplateParameterFields,
} from '../lib/send-parameters'
import { renderTemplatePreview } from '../lib/template-preview'

import type {
  SendParametersResult,
  TemplateParameterField,
} from '../lib/send-parameters'
import type { TemplatePreview } from '../lib/template-preview'

const PLACEHOLDERS: Record<TemplateParameterField['kind'], string> = {
  TEXT: 'Valor que substitui a variável',
  MEDIA: 'https://... (link do arquivo)',
  URL_SUFFIX: 'complemento-da-url',
  OTP: 'Código enviado ao cliente',
  PRODUCT: 'ID do produto no catálogo',
  FLOW: 'Token do Flow',
}

export interface TemplateParametersState {
  definition: TemplateDefinition | null
  fields: TemplateParameterField[]
  values: Record<string, string>
  errors: Record<string, string>
  isLoading: boolean
  /** Modelo aprovado cuja definição aprovada não está acessível pela API. */
  isBlocked: boolean
  canSubmit: boolean
  setValue: (id: string, value: string) => void
  build: () => SendParametersResult | null
}

const seed = (fields: TemplateParameterField[]) =>
  Object.fromEntries(fields.map(field => [field.id, field.defaultValue]))

/**
 * O envio usa a definição que a Meta aprovou (revisão `SUBMITTED` ou o espelho
 * remoto). O detalhe do modelo devolve a revisão mais nova — que pode ser um
 * rascunho com outras variáveis —, então a revisão enviada é buscada à parte
 * sempre que ela não for a mais nova.
 */
export const useTemplateParameters = (
  templateId: string | null,
): TemplateParametersState => {
  const detail = useQuery({
    ...getWhatsappTemplateOptions({ path: { id: templateId ?? '' } }),
    enabled: Boolean(templateId),
  })

  const template = detail.data ?? null
  const submitted = template?.submittedRevision ?? null
  const latest = template?.latestRevision ?? null
  const needsRevision = Boolean(submitted) && submitted?.id !== latest?.id

  const revisions = useQuery({
    ...listWhatsappTemplateRevisionsOptions({ path: { id: templateId ?? '' } }),
    enabled: Boolean(templateId) && needsRevision,
  })

  const isLoading =
    Boolean(templateId) &&
    (detail.isLoading || (needsRevision && revisions.isLoading))

  // Sem revisão enviada e com revisão local, a definição aprovada só existe no
  // espelho remoto, que a API não expõe — montar o formulário pelo rascunho
  // enviaria parâmetros que a Meta recusa.
  const isBlocked = Boolean(template) && !submitted && Boolean(latest)

  const definition = useMemo<TemplateDefinition | null>(() => {
    if (!template || isBlocked) return null

    if (needsRevision) {
      const revision = revisions.data?.data.find(
        item => item.id === submitted?.id,
      )

      return revision?.definition ?? null
    }

    return template.definition
  }, [template, isBlocked, needsRevision, revisions.data, submitted?.id])

  const fields = useMemo(
    () => (definition ? getTemplateParameterFields(definition) : []),
    [definition],
  )

  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Trocar de modelo (ou terminar de carregar a definição) descarta os valores
  // anteriores: dois modelos diferentes podem repetir o mesmo id de campo.
  const signature = `${templateId ?? ''}:${fields.map(field => field.id).join('|')}`
  const [lastSignature, setLastSignature] = useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    setValues(seed(fields))
    setErrors({})
  }

  const setValue = (id: string, value: string) => {
    setValues(current => ({ ...current, [id]: value }))
    setErrors(current => {
      if (!(id in current)) return current

      const next = { ...current }
      delete next[id]

      return next
    })
  }

  const build = () => {
    if (!definition) return null

    const result = buildSendParameters(fields, values)
    setErrors(result.success ? {} : result.errors)

    return result
  }

  return {
    definition,
    fields,
    values,
    errors,
    isLoading,
    isBlocked,
    canSubmit: Boolean(definition) && !isLoading,
    setValue,
    build,
  }
}

const PreviewButtons = ({
  buttons,
}: {
  buttons: TemplatePreview['buttons']
}) =>
  buttons.length === 0 ? null : (
    <ul className="text-muted-foreground space-y-0.5 border-t pt-2 text-xs">
      {buttons.map((button, index) => (
        <li key={index} className="truncate">
          {button.text}
          {button.detail ? ` — ${button.detail}` : ''}
        </li>
      ))}
    </ul>
  )

const PreviewHeaderLine = ({
  header,
}: {
  header: TemplatePreview['header']
}) => {
  if (!header) return null

  if (header.format === 'TEXT') {
    return <p className="font-medium">{header.text}</p>
  }

  return (
    <p className="text-muted-foreground text-xs">
      {header.format === 'LOCATION'
        ? 'Localização'
        : (header.media ?? 'Mídia do cabeçalho')}
    </p>
  )
}

const TemplatePreviewCard = ({ preview }: { preview: TemplatePreview }) => (
  <div className="bg-muted/40 space-y-2 rounded-md border p-3 text-sm">
    <PreviewHeaderLine header={preview.header} />

    {preview.body && <p className="whitespace-pre-wrap">{preview.body}</p>}

    {preview.offer && (
      <p className="text-muted-foreground text-xs">{preview.offer.text}</p>
    )}

    {preview.footer && (
      <p className="text-muted-foreground text-xs">{preview.footer}</p>
    )}

    {preview.cards.map((card, index) => (
      <div key={index} className="space-y-1 rounded-md border p-2">
        <p className="text-muted-foreground text-xs">
          Cartão {index + 1} — {card.media ?? 'sem mídia'}
        </p>
        <p className="text-xs whitespace-pre-wrap">{card.body}</p>
        <PreviewButtons buttons={card.buttons} />
      </div>
    ))}

    <PreviewButtons buttons={preview.buttons} />
  </div>
)

interface TemplateParameterFormProps {
  state: TemplateParametersState
  disabled?: boolean
}

export const TemplateParameterForm = ({
  state,
  disabled,
}: TemplateParameterFormProps) => {
  const { definition, fields, values, errors, isLoading, isBlocked } = state

  const loose = useMemo(() => {
    const ids = new Set(fields.map(field => field.id))

    return Object.entries(errors).filter(([key]) => !ids.has(key))
  }, [errors, fields])

  const preview = useMemo(() => {
    if (!definition) return null

    // Campo em branco cai no exemplo do modelo para a prévia acompanhar a
    // digitação mesmo antes de tudo estar preenchido.
    const filled = Object.fromEntries(
      fields.map(field => [
        field.id,
        values[field.id]?.trim() ? values[field.id]! : field.defaultValue,
      ]),
    )

    const result = buildSendParameters(fields, filled)

    return renderTemplatePreview(
      definition,
      result.success ? result.data : undefined,
    )
  }, [definition, fields, values])

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isBlocked) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Não é possível montar o envio deste modelo</AlertTitle>
        <AlertDescription>
          O modelo tem uma revisão local que ainda não foi aprovada, então a
          versão aprovada pela Meta não está disponível aqui. Envie a revisão
          para aprovação ou escolha outro modelo.
        </AlertDescription>
      </Alert>
    )
  }

  if (!definition || !preview) return null

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map(field => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id}>
                {field.label}
                {!field.required && (
                  <span className="text-muted-foreground text-xs">
                    (opcional)
                  </span>
                )}
              </Label>
              <Input
                id={field.id}
                value={values[field.id] ?? ''}
                onChange={event => state.setValue(field.id, event.target.value)}
                placeholder={PLACEHOLDERS[field.kind]}
                autoComplete="off"
                disabled={disabled}
                aria-invalid={Boolean(errors[field.id])}
              />
              {errors[field.id] && (
                <p className="text-destructive text-xs">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">
          Prévia da mensagem
        </p>
        <TemplatePreviewCard preview={preview} />
      </div>

      {/* Erro do schema cujo caminho não bate com nenhum campo — sem isto o
          envio ficaria travado sem dizer o porquê. */}
      {loose.map(([key, message]) => (
        <p key={key} className="text-destructive text-xs">
          {message}
        </p>
      ))}
    </div>
  )
}
