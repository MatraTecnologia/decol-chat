'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { startConversationMutation } from '@workspace/api-client/react-query'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

import { Button } from '@workspace/ui/components/button'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Spinner } from '@workspace/ui/components/spinner'

import { ApprovedTemplatePicker } from '@/features/templates/components/approved-template-picker'
import {
  TemplateParameterForm,
  useTemplateParameters,
} from '@/features/templates/components/template-parameter-form'
import { useUserRole } from '@/hooks'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { useSelectedConversation } from '../../hooks'
import { errorText } from '../../lib/api-error'

const DEFAULT_VALUES = {
  phone: '',
  name: '',
}

/**
 * O servidor aceita o número com máscara, então a validação roda só sobre os
 * dígitos — o valor digitado segue inteiro no corpo da requisição.
 */
const newConversationSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Informe o telefone')
    .superRefine((value, ctx) => {
      const digits = value.replace(/\D/g, '')

      if (digits.length < 10 || digits.length > 15) {
        ctx.addIssue({
          code: 'custom',
          message: 'O telefone deve ter entre 10 e 15 dígitos.',
        })
        return
      }

      if (
        digits.startsWith('55') &&
        digits.length !== 12 &&
        digits.length !== 13
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Número brasileiro: 55 + DDD + 8 dígitos (fixo) ou 9 dígitos (celular).',
        })
      }
    }),
  name: z.string(),
})

type NewConversationValues = z.infer<typeof newConversationSchema>

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NewConversationDialog = ({
  open,
  onOpenChange,
}: NewConversationDialogProps) => {
  const queryClient = useQueryClient()
  const { userId, hasRole } = useUserRole()
  const { selectConversation } = useSelectedConversation()

  /**
   * Conversa existente fora do alcance de quem abriu o formulário. `ownerName`
   * fica nulo quando ela ainda não tem responsável — o escopo do servidor
   * também barra esse caso para quem não é admin/gestor.
   */
  const [conflict, setConflict] = useState<{ ownerName: string | null } | null>(
    null,
  )

  // O modelo e seus parâmetros ficam fora do react-hook-form: o formulário só
  // valida telefone e nome, e os parâmetros vêm da definição aprovada.
  const [templateId, setTemplateId] = useState<string | null>(null)
  const parameters = useTemplateParameters(templateId)

  const form = useForm<NewConversationValues>({
    resolver: zodResolver(newConversationSchema),
    defaultValues: DEFAULT_VALUES,
  })

  // Limpar no fechamento (e não na abertura) deixa a próxima abertura pronta
  // sem precisar de um efeito que dispara render em cascata.
  const closeDialog = () => {
    onOpenChange(false)
    form.reset(DEFAULT_VALUES)
    setTemplateId(null)
    setConflict(null)
  }

  const start = useMutation({
    ...startConversationMutation(),
    onSuccess: ({ conversation, created }) => {
      invalidateByTags(queryClient, ['Conversations'])

      if (created) {
        toast.success('Conversa iniciada. O template foi enviado.')
        selectConversation(conversation.id)
        closeDialog()
        return
      }

      // `created: false` = já existia conversa em andamento. Ela é buscada sem
      // filtro de escopo, então pode ser de outro atendente — e abrir a de um
      // colega devolve 404 para quem não é admin/gestor.
      const isOwner = !!userId && conversation.assignedTo?.id === userId

      if (!isOwner && !hasRole('admin', 'manager')) {
        setConflict({ ownerName: conversation.assignedTo?.name ?? null })
        return
      }

      toast.success(
        'Este número já tinha uma conversa em andamento. Nenhum modelo foi enviado.',
      )
      selectConversation(conversation.id)
      closeDialog()
    },
    onError: error => {
      toast.error(errorText(error, 'Não foi possível iniciar a conversa'), {
        duration: 15_000,
      })
    },
  })

  const onSubmit = (values: NewConversationValues) => {
    if (!templateId) return

    const result = parameters.build()
    if (!result?.success) return

    const name = values.name.trim()

    start.mutate({
      body: {
        phone: values.phone.trim(),
        templateId,
        parameters: result.data,
        ...(name ? { name } : {}),
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (next) return onOpenChange(true)
        // Fechar no meio do envio deixaria a resposta chegar depois e escrever
        // o aviso de conflito num dialog já fechado — ele reapareceria vazio.
        if (start.isPending) return

        closeDialog()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Envie um modelo aprovado para abrir o atendimento com um número
            novo.
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <>
            <Alert variant="destructive">
              <UserCheck />
              <AlertTitle>
                {conflict.ownerName
                  ? `Este número já está em atendimento com ${conflict.ownerName}`
                  : 'Este número já tem uma conversa em andamento'}
              </AlertTitle>
              <AlertDescription>
                Nenhum modelo foi enviado. A conversa existente está fora do seu
                acesso, então ela não pode ser aberta por aqui — peça a
                reatribuição a um gestor.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" onClick={closeDialog}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Alert>
              <Info />
              <AlertTitle>Só dá para começar com um template</AlertTitle>
              <AlertDescription>
                A janela de texto livre do WhatsApp só abre depois que o cliente
                responde. Em um número sem conversa recente, a Meta entrega
                apenas modelos já aprovados.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="55 43 99914-0409"
                          autoComplete="off"
                          inputMode="tel"
                          disabled={start.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        DDI + DDD + número. Máscara é aceita.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1.5">
                  <Label>Modelo aprovado</Label>
                  <ApprovedTemplatePicker
                    value={templateId}
                    onChange={template => setTemplateId(template.id)}
                    disabled={start.isPending}
                  />
                </div>

                {templateId && (
                  <TemplateParameterForm
                    state={parameters}
                    disabled={start.isPending}
                  />
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do contato (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome de quem vai receber"
                          autoComplete="off"
                          disabled={start.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      start.isPending || !templateId || !parameters.canSubmit
                    }
                  >
                    {start.isPending && <Spinner />}
                    Iniciar conversa
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
