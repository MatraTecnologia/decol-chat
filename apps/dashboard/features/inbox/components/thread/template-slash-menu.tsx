'use client'

import type { KeyboardEvent } from 'react'

import { LayoutTemplate } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'

import {
  categoryLabel,
  useApprovedTemplates,
} from '@/features/templates/components/approved-template-picker'
import type { ApprovedTemplate } from '@/features/templates/components/approved-template-picker'

import { parseSlashCommand } from '../../lib/slash-command'

/** O menu flutua sobre a thread — mais que isso vira uma parede de opções. */
const MAX_ITEMS = 8

export interface TemplateSlashMenuState {
  open: boolean
  items: ApprovedTemplate[]
  highlight: number
  isLoading: boolean
  select: (template: ApprovedTemplate) => void
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean
}

interface UseTemplateSlashMenuInput {
  text: string
  enabled: boolean
  onSelect: (template: ApprovedTemplate) => void
}

/**
 * O rascunho continua sendo a única fonte da verdade do texto: o menu só o lê
 * para decidir se abre e o que filtrar, e quem fecha o comando é o composer ao
 * limpar o rascunho na escolha.
 */
export const useTemplateSlashMenu = ({
  text,
  enabled,
  onSelect,
}: UseTemplateSlashMenuInput): TemplateSlashMenuState => {
  const command = parseSlashCommand(text)
  const active = enabled && command.active

  const { templates, isLoading } = useApprovedTemplates(active)

  const [dismissed, setDismissed] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [lastText, setLastText] = useState(text)

  // Qualquer digitação reabre o menu fechado com Escape e volta a seleção para
  // o primeiro item, que é o que a nova busca traz.
  if (text !== lastText) {
    setLastText(text)
    setDismissed(false)
    setHighlight(0)
  }

  const query = command.query.toLowerCase()
  const items = templates
    .filter(template => template.name.toLowerCase().includes(query))
    .slice(0, MAX_ITEMS)

  const index = items.length > 0 ? Math.min(highlight, items.length - 1) : 0
  const open = active && !dismissed

  const select = (template: ApprovedTemplate) => {
    setDismissed(false)
    setHighlight(0)
    onSelect(template)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false

    if (event.key === 'Escape') {
      event.preventDefault()
      setDismissed(true)
      return true
    }

    const current = items[index]
    if (!current) return false

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlight((index + 1) % items.length)
        return true
      case 'ArrowUp':
        event.preventDefault()
        setHighlight((index - 1 + items.length) % items.length)
        return true
      case 'Enter':
      case 'Tab':
        // Acentuação em teclados pt-BR passa por composição — Enter aqui
        // confirma o caractere, não escolhe o modelo.
        if (event.nativeEvent.isComposing) return false

        event.preventDefault()
        select(current)
        return true
      default:
        return false
    }
  }

  return { open, items, highlight: index, isLoading, select, handleKeyDown }
}

interface TemplateSlashMenuProps {
  state: TemplateSlashMenuState
}

export const TemplateSlashMenu = ({ state }: TemplateSlashMenuProps) => {
  if (!state.open) return null

  return (
    <div
      role="listbox"
      aria-label="Modelos aprovados"
      className="bg-popover text-popover-foreground absolute inset-x-4 bottom-full z-20 mb-2 overflow-hidden rounded-md border shadow-md"
    >
      {state.isLoading ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">
          Carregando modelos...
        </p>
      ) : state.items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">
          Nenhum modelo aprovado com esse nome.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto p-1">
          {state.items.map((template, position) => (
            <li key={template.id}>
              <button
                type="button"
                role="option"
                aria-selected={position === state.highlight}
                // O textarea precisa manter o foco: sem isso o clique tira o
                // cursor e o rascunho perde a posição.
                onMouseDown={event => event.preventDefault()}
                onClick={() => state.select(template)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  position === state.highlight && 'bg-accent',
                )}
              >
                <LayoutTemplate className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{template.name}</span>
                <Badge variant="secondary" className="shrink-0">
                  {template.language}
                </Badge>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {categoryLabel(template.category)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
