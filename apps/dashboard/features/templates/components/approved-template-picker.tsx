'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, LayoutTemplate } from 'lucide-react'
import { useState } from 'react'

import { listWhatsappTemplatesOptions } from '@workspace/api-client/react-query'
import type { ListWhatsappTemplatesResponse } from '@workspace/api-client/types'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/popover'
import { cn } from '@workspace/ui/lib/utils'

export type ApprovedTemplate = ListWhatsappTemplatesResponse['data'][number]

/** A Meta limita a conta a poucas centenas de modelos — uma página basta. */
const PAGE_LIMIT = 100

export const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
}

export const categoryLabel = (category: string) =>
  CATEGORY_LABELS[category] ?? category

/**
 * Só busca quando o seletor está montado e visível — o composer monta o menu
 * em toda conversa aberta, inclusive para quem não pode enviar.
 */
export const useApprovedTemplates = (enabled = true) => {
  const query = useQuery({
    ...listWhatsappTemplatesOptions({
      query: { status: 'APPROVED', limit: PAGE_LIMIT },
    }),
    enabled,
  })

  return {
    templates: query.data?.data ?? [],
    isLoading: query.isLoading,
  }
}

interface ApprovedTemplatePickerProps {
  value: string | null
  onChange: (template: ApprovedTemplate) => void
  disabled?: boolean
}

export const ApprovedTemplatePicker = ({
  value,
  onChange,
  disabled,
}: ApprovedTemplatePickerProps) => {
  const [open, setOpen] = useState(false)
  const { templates, isLoading } = useApprovedTemplates(open || Boolean(value))

  const selected = templates.find(template => template.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <LayoutTemplate className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">
              {selected ? selected.name : 'Escolher um modelo aprovado'}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar modelo pelo nome..." />
          <CommandList>
            {isLoading ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Carregando modelos...
              </p>
            ) : (
              <>
                <CommandEmpty>Nenhum modelo aprovado encontrado.</CommandEmpty>
                <CommandGroup>
                  {templates.map(template => (
                    <CommandItem
                      key={template.id}
                      value={template.name}
                      onSelect={() => {
                        onChange(template)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4',
                          template.id === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {template.name}
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {template.language}
                      </Badge>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {categoryLabel(template.category)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
