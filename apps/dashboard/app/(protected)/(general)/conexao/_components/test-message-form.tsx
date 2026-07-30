'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, Send } from 'lucide-react'
import { useState } from 'react'
import { type Control, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  getWhatsappConnectionOptions,
  sendWhatsappTestMessageMutation,
} from '@workspace/api-client/react-query'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Spinner } from '@workspace/ui/components/spinner'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group'

const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)

const testMessageSchema = z
  .object({
    kind: z.enum(['text', 'template']),
    to: z
      .string()
      .min(10, 'Informe o número completo, com país e DDD')
      .regex(/^\d+$/, 'Use apenas dígitos — sem +, espaços ou traços'),
    text: z.string().max(1000, 'Máximo de 1000 caracteres'),
    templateName: z.string(),
    languageCode: z.string(),
  })
  .refine(data => data.kind !== 'text' || data.text.trim().length > 0, {
    message: 'Escreva o texto da mensagem',
    path: ['text'],
  })
  .refine(
    data => data.kind !== 'template' || data.templateName.trim().length > 0,
    {
      message: 'Informe o nome do template',
      path: ['templateName'],
    },
  )
  .refine(
    data => data.kind !== 'template' || data.languageCode.trim().length > 0,
    {
      message: 'Informe o código de idioma',
      path: ['languageCode'],
    },
  )

type TestMessageFormValues = z.infer<typeof testMessageSchema>

type ModeFieldsProps = {
  control: Control<TestMessageFormValues>
  isDisabled: boolean
}

const TextModeFields = ({ control, isDisabled }: ModeFieldsProps) => (
  <FormField
    control={control}
    name="text"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Mensagem</FormLabel>
        <FormControl>
          <Textarea
            rows={3}
            placeholder="Texto que será entregue no WhatsApp"
            disabled={isDisabled}
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)

const TemplateModeFields = ({ control, isDisabled }: ModeFieldsProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <FormField
      control={control}
      name="templateName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do template</FormLabel>
          <FormControl>
            <Input
              placeholder="hello_world"
              autoComplete="off"
              disabled={isDisabled}
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
      control={control}
      name="languageCode"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Código de idioma</FormLabel>
          <FormControl>
            <Input
              placeholder="en_US"
              autoComplete="off"
              disabled={isDisabled}
              {...field}
            />
          </FormControl>
          <FormDescription>
            Exatamente o idioma cadastrado no template (ex.: en_US, pt_BR).
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
)

const SentMessageId = ({ messageId }: { messageId: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar o ID da mensagem')
    }
  }

  return (
    <div className="bg-muted/50 mt-4 space-y-2 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">
        Última mensagem enviada — procure este <code>wamid</code> no console de
        eventos para acompanhar o status de entrega.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          {messageId}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          aria-label="Copiar ID da mensagem"
        >
          {copied ? (
            <Check className="size-4 text-green-600" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

export const TestMessageForm = () => {
  const [lastMessageId, setLastMessageId] = useState<string | null>(null)

  const { data, isPending: isLoadingConnection } = useQuery(
    getWhatsappConnectionOptions(),
  )

  const form = useForm<TestMessageFormValues>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: {
      kind: 'text',
      to: '',
      text: 'Mensagem de teste da bancada de integração.',
      templateName: 'hello_world',
      languageCode: 'en_US',
    },
  })

  const kind = form.watch('kind')

  const send = useMutation({
    ...sendWhatsappTestMessageMutation(),
    onSuccess: response => {
      setLastMessageId(response.messageId)
      toast.success('Mensagem enviada.', {
        description: response.messageId,
        duration: 15000,
        action: {
          label: 'Copiar ID',
          onClick: () => navigator.clipboard.writeText(response.messageId),
        },
      })
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível enviar a mensagem'), {
        duration: 15000,
      })
    },
  })

  const isConfigured = Boolean(data?.configured)
  const isDisabled = isLoadingConnection || !isConfigured || send.isPending

  const onSubmit = (values: TestMessageFormValues) => {
    const to = values.to.trim()

    send.mutate({
      body:
        values.kind === 'template'
          ? {
              to,
              kind: 'template',
              templateName: values.templateName.trim(),
              languageCode: values.languageCode.trim(),
            }
          : { to, kind: 'text', text: values.text.trim() },
    })
  }

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Send className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">Mensagem de teste</CardTitle>
          <CardDescription>
            Envia um texto livre ou um template aprovado pela Graph API e
            registra a chamada no console como evento de saída.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de envio</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      spacing={1}
                      value={field.value}
                      onValueChange={value => value && field.onChange(value)}
                      disabled={isDisabled}
                    >
                      <ToggleGroupItem
                        value="text"
                        aria-label="Enviar texto livre"
                      >
                        Texto livre
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="template"
                        aria-label="Enviar template"
                      >
                        Template
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormDescription>
                    Texto livre só é entregue se o contato escreveu para você nas
                    últimas 24h. Fora dessa janela a Meta recusa o envio (erro
                    131047) — use um template aprovado.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de destino</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="5543999140409"
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={isDisabled}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Formato E.164 sem o sinal de mais: país + DDD + número (ex.:
                    5543999140409).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {kind === 'template' ? (
              <TemplateModeFields
                control={form.control}
                isDisabled={isDisabled}
              />
            ) : (
              <TextModeFields control={form.control} isDisabled={isDisabled} />
            )}

            {!isLoadingConnection && !isConfigured && (
              <p className="text-muted-foreground text-sm">
                Configure as credenciais antes de enviar uma mensagem de teste.
              </p>
            )}

            <Button type="submit" disabled={isDisabled}>
              {send.isPending ? (
                <>
                  <Spinner className="mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  Enviar mensagem
                </>
              )}
            </Button>
          </form>
        </Form>

        {lastMessageId && <SentMessageId messageId={lastMessageId} />}
      </CardContent>
    </Card>
  )
}
