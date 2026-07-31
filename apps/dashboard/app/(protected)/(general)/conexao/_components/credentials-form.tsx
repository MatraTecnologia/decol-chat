'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, ShieldAlert, Trash2, Wand2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  deleteWhatsappConnectionMutation,
  getWhatsappConnectionOptions,
  updateWhatsappConnectionMutation,
} from '@workspace/api-client/react-query'
import type { GetWhatsappConnectionResponse } from '@workspace/api-client/types'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog'

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
import { PasswordInput } from '@workspace/ui/components/password-input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

type WhatsappConnection = NonNullable<
  GetWhatsappConnectionResponse['connection']
>

const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)

const credentialsSchema = z.object({
  accessToken: z.string().min(1, 'Cole o access token completo'),
  appSecret: z.string().min(1, 'Cole o app secret completo'),
  phoneNumberId: z.string().min(1, 'Informe o Phone Number ID'),
  wabaId: z.string().min(1, 'Informe o WABA ID'),
  appId: z.string(),
  verifyToken: z.string().min(1, 'Informe ou gere um verify token'),
  webhookBaseUrl: z.union([
    z.literal(''),
    z.url('Informe uma URL completa, com https://'),
  ]),
})

type CredentialsFormValues = z.infer<typeof credentialsSchema>

const toFormValues = (
  connection: WhatsappConnection | null,
): CredentialsFormValues => ({
  accessToken: '',
  appSecret: '',
  phoneNumberId: connection?.phoneNumberId ?? '',
  wabaId: connection?.wabaId ?? '',
  appId: connection?.appId ?? '',
  verifyToken: connection?.verifyToken ?? '',
  webhookBaseUrl: connection?.webhookBaseUrl ?? '',
})

interface CredentialsFieldsProps {
  connection: WhatsappConnection | null
  disabled?: boolean
}

const CredentialsFields = ({
  connection,
  disabled,
}: CredentialsFieldsProps) => {
  const queryClient = useQueryClient()

  const form = useForm<CredentialsFormValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: toFormValues(connection),
  })

  const update = useMutation({
    ...updateWhatsappConnectionMutation(),
    onSuccess: data => {
      toast.success('Credenciais validadas na Graph API e salvas.')
      form.reset(toFormValues(data.connection))
      invalidateByTags(queryClient, ['WhatsApp'])
    },
    onError: error => {
      toast.error(
        apiErrorMessage(error, 'Não foi possível salvar as credenciais'),
        { duration: 15000 },
      )
    },
  })

  const remove = useMutation({
    ...deleteWhatsappConnectionMutation(),
    onSuccess: () => {
      toast.success('Conexão removida.')
      form.reset(toFormValues(null))
      invalidateByTags(queryClient, ['WhatsApp'])
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível remover a conexão'))
    },
  })

  const isBusy = disabled || update.isPending || remove.isPending

  const onSubmit = (values: CredentialsFormValues) => {
    update.mutate({
      body: {
        accessToken: values.accessToken.trim(),
        appSecret: values.appSecret.trim(),
        phoneNumberId: values.phoneNumberId.trim(),
        wabaId: values.wabaId.trim(),
        appId: values.appId.trim() || undefined,
        verifyToken: values.verifyToken.trim(),
        webhookBaseUrl: values.webhookBaseUrl.trim() || undefined,
      },
    })
  }

  const handleGenerateVerifyToken = () => {
    form.setValue('verifyToken', crypto.randomUUID().replace(/-/g, ''), {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access Token</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="off"
                  placeholder={
                    connection
                      ? `Atual: ${connection.accessToken}`
                      : 'System User Token (EAAG...)'
                  }
                  disabled={isBusy}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                O token salvo nunca é exibido. Ao atualizar qualquer campo, cole
                o valor completo de novo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="appSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Secret</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="off"
                  placeholder={
                    connection
                      ? `Atual: ${connection.appSecret}`
                      : 'Segredo do app na Meta'
                  }
                  disabled={isBusy}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Usado para validar a assinatura HMAC dos eventos do webhook.
                Também precisa ser colado de novo a cada atualização.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phoneNumberId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="123456789012345"
                    inputMode="numeric"
                    disabled={isBusy}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wabaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WABA ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="098765432109876"
                    inputMode="numeric"
                    disabled={isBusy}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="appId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                App ID{' '}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="1234567890123456"
                  inputMode="numeric"
                  disabled={isBusy}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Não é segredo. Habilita a verificação de quais campos do webhook
                o app tem assinados — sem ele, esse item do checklist fica sem
                resposta.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="verifyToken"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Verify Token</FormLabel>
                <button
                  type="button"
                  onClick={handleGenerateVerifyToken}
                  disabled={isBusy}
                  className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                >
                  <Wand2 className="size-3" />
                  Gerar
                </button>
              </div>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="Valor que você define e repete na Meta"
                  disabled={isBusy}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Você inventa este valor e repete o mesmo no App Dashboard da
                Meta ao configurar o webhook.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="webhookBaseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Webhook Base URL{' '}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="https://seu-tunel.ngrok-free.app"
                  disabled={isBusy}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Sobrescreve a base pública do env. Use a origem do túnel em
                desenvolvimento — ela muda a cada restart do ngrok.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="submit" disabled={isBusy}>
            {update.isPending ? (
              <>
                <Spinner className="mr-2" />
                Validando...
              </>
            ) : (
              'Salvar credenciais'
            )}
          </Button>

          {connection && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={isBusy}>
                  <Trash2 className="mr-2 size-4" />
                  Remover conexão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover a conexão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    As credenciais salvas serão apagadas e o webhook deixa de
                    validar os eventos da Meta. Para voltar a usar, cole tudo de
                    novo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate({})}>
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </Form>
  )
}

export const CredentialsForm = () => {
  const { data, isPending } = useQuery(getWhatsappConnectionOptions())

  const renderContent = () => {
    if (isPending) {
      return (
        <div className="space-y-4">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      )
    }

    if (!data) {
      return (
        <p className="text-muted-foreground text-sm">
          Não foi possível carregar o estado da conexão.
        </p>
      )
    }

    return (
      <div className="space-y-4">
        {!data.encryptionConfigured && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Criptografia não configurada</AlertTitle>
            <AlertDescription>
              Defina a variável{' '}
              <code className="font-mono">WHATSAPP_ENCRYPTION_KEY</code> (32
              bytes em base64) no <code className="font-mono">.env</code> da API
              e reinicie o servidor. Sem ela os segredos não podem ser cifrados,
              e o formulário fica desabilitado.
            </AlertDescription>
          </Alert>
        )}

        <CredentialsFields
          connection={data.connection}
          disabled={!data.encryptionConfigured}
        />
      </div>
    )
  }

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <KeyRound className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">Credenciais</CardTitle>
          <CardDescription>
            Validadas contra a Graph API antes de gravar. Token e app secret
            ficam cifrados em repouso.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )
}
