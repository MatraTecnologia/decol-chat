'use client'

import type { KeyboardEvent } from 'react'

import { Clock, Lock, SendHorizontal } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'
import { Textarea } from '@workspace/ui/components/textarea'

import { useMessageDrafts } from '../../hooks'
import { SendTemplateDialog } from './send-template-dialog'
import { useSendMessage } from './use-send-message'

interface ComposerProps {
  conversationId: string
  canSendFreeText: boolean
  disabled?: boolean
}

const MAX_LENGTH = 4096

const ComposerNotice = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2.5 text-xs">
    {children}
  </div>
)

export const Composer = ({
  conversationId,
  canSendFreeText,
  disabled,
}: ComposerProps) => {
  // O `getDraft` do store não re-renderiza; ler o valor por seletor sim.
  const draft = useMessageDrafts(state => state.drafts[conversationId] ?? '')
  const setDraft = useMessageDrafts(state => state.setDraft)
  const clearDraft = useMessageDrafts(state => state.clearDraft)

  const { send, isPending } = useSendMessage(conversationId)

  const text = draft.trim()
  const canSubmit = Boolean(text) && !isPending

  const handleSend = () => {
    if (!canSubmit) return

    clearDraft(conversationId)
    void send({ text })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    // Acentuação em teclados pt-BR passa por composição — Enter aqui confirma
    // o caractere, não envia a mensagem.
    if (event.nativeEvent.isComposing) return

    event.preventDefault()
    handleSend()
  }

  if (disabled) {
    return (
      <div className="shrink-0 border-t px-4 py-3">
        <ComposerNotice>
          <Lock className="size-3.5 shrink-0" />
          <span>
            Seu perfil é somente leitura — o envio de mensagens está
            desabilitado.
          </span>
        </ComposerNotice>
      </div>
    )
  }

  if (!canSendFreeText) {
    return (
      <div className="shrink-0 border-t px-4 py-3">
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2.5">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Clock className="size-3.5 shrink-0" />
            <span>
              A janela de 24h expirou — só um template aprovado pode ser
              enviado.
            </span>
          </div>
          <SendTemplateDialog conversationId={conversationId} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-end gap-2 border-t px-4 py-3">
      <Textarea
        value={draft}
        onChange={event => setDraft(conversationId, event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={MAX_LENGTH}
        placeholder="Escreva uma mensagem — Enter envia, Shift+Enter quebra linha"
        aria-label="Mensagem"
        className="max-h-32 min-h-9 resize-none py-2"
      />

      <Button
        type="button"
        size="icon"
        onClick={handleSend}
        disabled={!canSubmit}
        aria-label="Enviar mensagem"
      >
        {isPending ? <Spinner /> : <SendHorizontal className="size-4" />}
      </Button>
    </div>
  )
}
