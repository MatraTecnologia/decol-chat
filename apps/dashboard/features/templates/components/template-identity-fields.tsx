'use client'

import type { Control } from 'react-hook-form'

import { Input } from '@workspace/ui/components/input'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import type { TemplateFormValues } from './template-editor-form'
import { LANGUAGE_OPTIONS } from './template-status-badge'

const categories = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utilidade' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

/** Modelo sincronizado pode vir num idioma fora da lista curada. */
const withCurrentLanguage = (value: string) =>
  LANGUAGE_OPTIONS.some(option => option.value === value)
    ? LANGUAGE_OPTIONS
    : [...LANGUAGE_OPTIONS, { value, label: value }]

const parameterFormats = [
  { value: 'POSITIONAL', label: 'Posicional — {{1}}, {{2}}' },
  { value: 'NAMED', label: 'Nomeado — {{nome}}, {{pedido}}' },
]

interface TemplateIdentityFieldsProps {
  control: Control<TemplateFormValues>
  nameDisabled: boolean
  /** Nome e idioma formam a identidade do modelo na Meta. */
  languageDisabled: boolean
  disabled: boolean
}

export const TemplateIdentityFields = ({
  control,
  nameDisabled,
  languageDisabled,
  disabled,
}: TemplateIdentityFieldsProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel>Nome</FormLabel>
          <FormControl>
            <Input
              placeholder="confirmacao_pedido"
              autoComplete="off"
              disabled={disabled}
              readOnly={nameDisabled}
              {...field}
              onChange={event =>
                field.onChange(event.target.value.toLowerCase())
              }
            />
          </FormControl>
          <FormDescription>
            {nameDisabled
              ? 'A Meta não permite renomear um modelo existente.'
              : 'Somente letras minúsculas, números e underline.'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={control}
      name="definition.category"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Categoria</FormLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={control}
      name="definition.language"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Idioma</FormLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled || languageDisabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {withCurrentLanguage(field.value).map(language => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {languageDisabled && (
            <FormDescription>
              Para outro idioma, crie um novo modelo.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={control}
      name="definition.parameterFormat"
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel>Formato de parâmetro</FormLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {parameterFormats.map(format => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
)
