'use client'

import {
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Mic,
  RotateCcw,
  Sticker,
  Video,
} from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'

import {
  formatBubbleTime,
  formatFullTime,
} from '../../lib/format-message-time'
import type { Message } from '../../types'
import { MessageStatusIcon } from './message-status-icon'

interface MessageBubbleProps {
  message: Message
  onRetry?: (message: Message) => void
}

const mediaMap = {
  IMAGE: { Icon: ImageIcon, label: 'Imagem' },
  AUDIO: { Icon: Mic, label: 'Áudio' },
  VIDEO: { Icon: Video, label: 'Vídeo' },
  DOCUMENT: { Icon: FileText, label: 'Documento' },
  STICKER: { Icon: Sticker, label: 'Figurinha' },
} as const

type MediaType = keyof typeof mediaMap

const isMediaType = (type: Message['type']): type is MediaType =>
  type in mediaMap

const MessageContent = ({ message }: MessageBubbleProps) => {
  if (message.type === 'TEXT') {
    return (
      <p className="text-sm break-words whitespace-pre-wrap">
        {message.content}
      </p>
    )
  }

  if (isMediaType(message.type)) {
    const { Icon, label } = mediaMap[message.type]

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-md bg-black/5 px-2.5 py-2 dark:bg-white/10">
          <Icon className="size-4 shrink-0" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        {message.content && (
          <p className="text-sm break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    )
  }

  if (message.type === 'TEMPLATE') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-md bg-black/5 px-2.5 py-2 dark:bg-white/10">
          <LayoutTemplate className="size-4 shrink-0" />
          <span className="text-xs font-medium">
            Template: {message.templateName ?? 'sem nome'}
          </span>
        </div>
        {message.content && (
          <p className="text-sm break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    )
  }

  return (
    <p className="text-sm italic opacity-80">Mensagem não suportada</p>
  )
}

export const MessageBubble = ({ message, onRetry }: MessageBubbleProps) => {
  const isOutbound = message.direction === 'OUTBOUND'
  const hasFailed = message.status === 'FAILED'
  const timestamp = message.waTimestamp ?? message.createdAt

  return (
    <div
      className={cn(
        'flex w-full px-4 py-0.5',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[min(32rem,85%)] min-w-0 space-y-1 rounded-lg px-3 py-2 shadow-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          hasFailed &&
            'border-destructive/50 bg-destructive/10 text-foreground border',
        )}
      >
        <MessageContent message={message} />

        {hasFailed && message.errorMessage && (
          <p className="text-destructive text-xs font-medium break-words">
            {message.errorMessage}
          </p>
        )}

        {hasFailed && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRetry(message)}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="size-3.5" />
            Reenviar
          </Button>
        )}

        <div
          className={cn(
            'flex items-center justify-end gap-1',
            isOutbound && !hasFailed
              ? 'text-primary-foreground/70'
              : 'text-muted-foreground',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] tabular-nums">
                {formatBubbleTime(timestamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{formatFullTime(timestamp)}</TooltipContent>
          </Tooltip>

          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}
