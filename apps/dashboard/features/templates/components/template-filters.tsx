'use client'

import { Search, X } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import {
  CATEGORY_LABELS,
  LANGUAGE_OPTIONS,
  REMOTE_STATUS_LABELS,
  REMOTE_STATUS_VALUES,
} from './template-status-badge'

const CATEGORY_VALUES = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

interface TemplateFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  category: string | null
  onCategoryChange: (value: string | null) => void
  status: string | null
  onStatusChange: (value: string | null) => void
  language: string | null
  onLanguageChange: (value: string | null) => void
  /** Presente só com algum filtro ativo. */
  onClear?: () => void
}

export const TemplateFilters = ({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  language,
  onLanguageChange,
  onClear,
}: TemplateFiltersProps) => {
  // Um idioma vindo da URL pode não estar na lista curada; sem isso o Select
  // ficaria com o gatilho vazio mesmo com o filtro ativo.
  const languageOptions =
    language && !LANGUAGE_OPTIONS.some(option => option.value === language)
      ? [...LANGUAGE_OPTIONS, { value: language, label: language }]
      : LANGUAGE_OPTIONS

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar pelo nome do modelo..."
            value={search}
            type="search"
            onChange={event => onSearchChange(event.target.value)}
            className="pl-9"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
          />
        </div>

        <Select
          value={category ?? 'all'}
          onValueChange={value =>
            onCategoryChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORY_VALUES.map(value => (
              <SelectItem key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status ?? 'all'}
          onValueChange={value =>
            onStatusChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {REMOTE_STATUS_VALUES.map(value => (
              <SelectItem key={value} value={value}>
                {REMOTE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={language ?? 'all'}
          onValueChange={value =>
            onLanguageChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Todos os idiomas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os idiomas</SelectItem>
            {languageOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onClear && (
          <Button variant="ghost" onClick={onClear} className="lg:shrink-0">
            <X className="size-4" />
            Limpar
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
