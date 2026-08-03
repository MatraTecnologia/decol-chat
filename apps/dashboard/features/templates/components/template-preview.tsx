'use client'

import {
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  ShoppingBag,
  Timer,
  Video,
  Workflow,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

import { renderTemplatePreview } from '../lib/template-preview'

import type {
  PreviewButton,
  PreviewCard,
  PreviewHeader,
  TemplatePreview as Preview,
} from '../lib/template-preview'

const mediaIcons = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
} satisfies Record<string, LucideIcon>

const mediaLabels = {
  IMAGE: 'Imagem',
  VIDEO: 'Vídeo',
  DOCUMENT: 'Documento',
}

const buttonIcons: Record<PreviewButton['kind'], LucideIcon> = {
  QUICK_REPLY: MessageSquare,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  OTP: Copy,
  CATALOG: ShoppingBag,
  FLOW: Workflow,
}

const MediaBlock = ({
  format,
  media,
}: {
  format: keyof typeof mediaIcons
  media: string | null
}) => {
  const Icon = mediaIcons[format]

  return (
    <div className="text-muted-foreground flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-black/5 text-xs dark:bg-white/10">
      <Icon className="size-5" />
      <span>{media ?? mediaLabels[format]}</span>
    </div>
  )
}

const HeaderBlock = ({ header }: { header: PreviewHeader }) => {
  if (header.format === 'TEXT') {
    return <p className="text-sm font-semibold">{header.text}</p>
  }

  if (header.format === 'LOCATION') {
    return (
      <div className="text-muted-foreground flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-black/5 text-xs dark:bg-white/10">
        <MapPin className="size-5" />
        <span>Localização</span>
      </div>
    )
  }

  return <MediaBlock format={header.format} media={header.media} />
}

const ButtonList = ({ buttons }: { buttons: PreviewButton[] }) => {
  if (buttons.length === 0) return null

  return (
    <div className="mt-1 flex flex-col gap-px">
      {buttons.map((button, index) => {
        const Icon = buttonIcons[button.kind] ?? MessageSquare

        return (
          <div
            key={`${button.kind}-${index}`}
            className="flex items-center justify-center gap-1.5 rounded-md bg-white/70 px-2 py-1.5 text-xs font-medium text-emerald-800 dark:bg-white/10 dark:text-emerald-200"
            title={button.detail ?? undefined}
          >
            <Icon className="size-3.5" />
            <span className="truncate">{button.text || 'Botão'}</span>
          </div>
        )
      })}
    </div>
  )
}

const CardBlock = ({ card }: { card: PreviewCard }) => (
  <div className="w-44 shrink-0 rounded-lg bg-white/70 p-2 dark:bg-white/10">
    <MediaBlock format={card.format} media={card.media} />
    <p className="mt-2 text-xs whitespace-pre-wrap">{card.body}</p>
    <ButtonList buttons={card.buttons} />
  </div>
)

const Bubble = ({ preview }: { preview: Preview }) => (
  <div className="flex flex-col gap-2 rounded-xl rounded-tr-sm bg-emerald-100 p-3 shadow-sm dark:bg-emerald-900/50">
    {preview.header && <HeaderBlock header={preview.header} />}

    {preview.body && (
      <p className="text-sm whitespace-pre-wrap">{preview.body}</p>
    )}

    {preview.offer && (
      <div className="flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-1.5 text-xs dark:bg-white/10">
        <Timer className="size-3.5" />
        <span>{preview.offer.text}</span>
        {preview.offer.hasExpiration && (
          <span className="text-muted-foreground">— expira em breve</span>
        )}
      </div>
    )}

    {preview.footer && (
      <p className="text-muted-foreground text-xs">{preview.footer}</p>
    )}

    {preview.cards.length > 0 && (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {preview.cards.map((card, index) => (
          <CardBlock key={index} card={card} />
        ))}
      </div>
    )}

    <ButtonList buttons={preview.buttons} />

    {preview.advanced.map((block, index) => (
      <div
        key={`${block.label}-${index}`}
        className="text-muted-foreground rounded-md border border-dashed px-2 py-1.5 text-xs"
      >
        Componente avançado: {block.label}
      </div>
    ))}
  </div>
)

/** Erro de preview nunca derruba o editor — o formulário fica intacto. */
const safePreview = (definition: TemplateDefinition) => {
  try {
    return { preview: renderTemplatePreview(definition), failed: false }
  } catch {
    return { preview: null, failed: true }
  }
}

interface TemplatePreviewProps {
  definition: TemplateDefinition
}

export const TemplatePreview = ({ definition }: TemplatePreviewProps) => {
  const { preview, failed } = safePreview(definition)

  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <p className="mb-2 text-sm font-medium">Simulador</p>

      <div className="rounded-xl border bg-[#efe7dd] p-3 dark:bg-neutral-900">
        {preview ? (
          <Bubble preview={preview} />
        ) : (
          <p className="text-muted-foreground text-xs">
            {failed
              ? 'A pré-visualização ficará disponível quando os campos estiverem completos.'
              : 'Adicione um componente para visualizar a mensagem.'}
          </p>
        )}
      </div>
    </div>
  )
}
