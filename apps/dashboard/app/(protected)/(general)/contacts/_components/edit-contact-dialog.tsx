'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { updateContactMutation } from '@workspace/api-client/react-query'
import type { UpdateContactData } from '@workspace/api-client/types'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Spinner } from '@workspace/ui/components/spinner'
import { Textarea } from '@workspace/ui/components/textarea'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { apiErrorMessage, getDisplayName } from './contact-utils'
import type { ContactTarget } from './contacts-table'

const editContactSchema = z.object({
  name: z.string(),
  email: z.union([z.literal(''), z.email('Informe um e-mail válido')]),
  notes: z.string(),
})

type EditContactValues = z.infer<typeof editContactSchema>

interface EditContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: ContactTarget | null
}

const toFormValues = (contact: ContactTarget | null): EditContactValues => ({
  name: contact?.name ?? '',
  email: contact?.email ?? '',
  notes: contact?.notes ?? '',
})

export const EditContactDialog = ({
  open,
  onOpenChange,
  contact,
}: EditContactDialogProps) => {
  const queryClient = useQueryClient()

  const form = useForm<EditContactValues>({
    resolver: zodResolver(editContactSchema),
    defaultValues: toFormValues(null),
  })

  useEffect(() => {
    if (open) form.reset(toFormValues(contact))
  }, [open, contact, form])

  const update = useMutation({
    ...updateContactMutation(),
    onSuccess: () => {
      toast.success('Contato atualizado.')
      invalidateByTags(queryClient, ['Contacts'])
      onOpenChange(false)
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível salvar o contato'))
    },
  })

  const onSubmit = (values: EditContactValues) => {
    if (!contact) return

    // Campo omitido não mexe no valor; `null` limpa. Só mandamos o que mudou.
    const body: UpdateContactData['body'] = {}
    const name = values.name.trim()
    const email = values.email.trim()
    const notes = values.notes.trim()

    if (name !== (contact.name ?? '')) body.name = name || null
    if (email !== (contact.email ?? '')) body.email = email || null
    if (notes !== (contact.notes ?? '')) body.notes = notes || null

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }

    update.mutate({ path: { id: contact.id }, body })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>
            Atualize os dados internos de{' '}
            {contact ? getDisplayName(contact) : ''}. O telefone vem do WhatsApp
            e não pode ser alterado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do contato"
                      disabled={update.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Deixe em branco para voltar a usar o nome do perfil do
                    WhatsApp.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contato@empresa.com"
                      disabled={update.isPending}
                      autoCapitalize="off"
                      autoCorrect="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Anotações internas sobre o contato"
                      disabled={update.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={update.isPending}
            >
              {update.isPending ? (
                <>
                  <Spinner className="mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
