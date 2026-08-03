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

const categories = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utilidade' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

const languages = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'pt_PT', label: 'Português (Portugal)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'en_GB', label: 'Inglês (Reino Unido)' },
  { value: 'es_ES', label: 'Espanhol (Espanha)' },
  { value: 'es_AR', label: 'Espanhol (Argentina)' },
  { value: 'es_MX', label: 'Espanhol (México)' },
  { value: 'fr', label: 'Francês' },
  { value: 'it', label: 'Italiano' },
  { value: 'de', label: 'Alemão' },
]

const parameterFormats = [
  { value: 'POSITIONAL', label: 'Posicional — {{1}}, {{2}}' },
  { value: 'NAMED', label: 'Nomeado — {{nome}}, {{pedido}}' },
]

interface TemplateIdentityFieldsProps {
  control: Control<TemplateFormValues>
  nameDisabled: boolean
  disabled: boolean
}

export const TemplateIdentityFields = ({
  control,
  nameDisabled,
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
              disabled={disabled || nameDisabled}
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
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {languages.map(language => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
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
