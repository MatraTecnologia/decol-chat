'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LayoutTemplate } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Spinner } from '@workspace/ui/components/spinner'

import { errorText } from '../../lib/api-error'
import { useSendTemplateMessage } from './use-send-message'

interface SendTemplateDialogProps {
  conversationId: string
  disabled?: boolean
}

const templateSchema = z.object({
  templateName: z.string().trim().min(1, 'Informe o nome do template'),
  languageCode: z.string().trim().min(1, 'Informe o código de idioma'),
})

type TemplateFormValues = z.infer<typeof templateSchema>

export const SendTemplateDialog = ({
  conversationId,
  disabled,
}: SendTemplateDialogProps) => {
  const [open, setOpen] = useState(false)
  const sendTemplate = useSendTemplateMessage(conversationId)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { templateName: '', languageCode: 'pt_BR' },
  })

  const onSubmit = (values: TemplateFormValues) => {
    sendTemplate.mutate(
      {
        path: { id: conversationId },
        body: {
          templateName: values.templateName,
          languageCode: values.languageCode,
        },
      },
      {
        onSuccess: () => {
          setOpen(false)
          form.reset({ templateName: '', languageCode: values.languageCode })
        },
        onError: error => {
          toast.error(errorText(error, 'Não foi possível enviar o template'))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <LayoutTemplate className="size-4" />
          Enviar template
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar template</DialogTitle>
          <DialogDescription>
            Fora da janela de 24h só um modelo aprovado pela Meta é entregue.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="templateName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do template</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="retomada_atendimento"
                      autoComplete="off"
                      disabled={sendTemplate.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Precisa estar aprovado no WhatsApp Manager.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="languageCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de idioma</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="pt_BR"
                      autoComplete="off"
                      disabled={sendTemplate.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Exatamente o idioma cadastrado no template (ex.: pt_BR,
                    en_US).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={sendTemplate.isPending}>
                {sendTemplate.isPending && <Spinner />}
                Enviar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
