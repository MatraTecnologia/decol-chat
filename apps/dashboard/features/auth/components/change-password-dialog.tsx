'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { PasswordInput } from '@workspace/ui/components/password-input'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'

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

import { useChangePassword } from '../api/mutations'
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas'

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Fraca', color: 'bg-destructive' }
  if (score <= 2) return { score, label: 'Razoável', color: 'bg-orange-500' }
  if (score <= 3) return { score, label: 'Boa', color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Forte', color: 'bg-green-500' }
  return { score, label: 'Muito forte', color: 'bg-green-600' }
}

function generatePassword(length = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%&*?'
  const allChars = lowercase + uppercase + numbers + symbols

  const randomChar = (str: string) =>
    str.charAt(Math.floor(Math.random() * str.length))

  let password =
    randomChar(lowercase) +
    randomChar(uppercase) +
    randomChar(numbers) +
    randomChar(symbols)

  for (let i = password.length; i < length; i++) {
    password += randomChar(allChars)
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const changePassword = useChangePassword()

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      revokeOtherSessions: false,
    },
  })

  const newPassword = useWatch({ control: form.control, name: 'newPassword' })
  const passwordStrength = useMemo(
    () => getPasswordStrength(newPassword || ''),
    [newPassword],
  )

  async function handleGeneratePassword() {
    const password = generatePassword()
    form.setValue('newPassword', password, { shouldValidate: true })
    form.setValue('confirmPassword', password, { shouldValidate: true })

    await navigator.clipboard.writeText(password)
    toast.success('Senha gerada e copiada para a área de transferência!')
  }

  function onSubmit(data: ChangePasswordFormValues) {
    changePassword.mutate(
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: data.revokeOtherSessions,
      },
      {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            Digite sua senha atual e a nova senha desejada
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha atual</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="********"
                      autoComplete="current-password"
                      disabled={changePassword.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Nova senha</FormLabel>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      disabled={changePassword.isPending}
                      className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="size-3" />
                      Gerar senha
                    </button>
                  </div>
                  <FormControl>
                    <PasswordInput
                      placeholder="********"
                      autoComplete="new-password"
                      disabled={changePassword.isPending}
                      {...field}
                    />
                  </FormControl>
                  {newPassword && newPassword.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(level => (
                          <div
                            key={level}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              level <= passwordStrength.score
                                ? passwordStrength.color
                                : 'bg-muted',
                            )}
                          />
                        ))}
                      </div>
                      <p
                        className={cn(
                          'text-xs',
                          passwordStrength.score <= 2
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        Força da senha: {passwordStrength.label}
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nova senha</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="********"
                      autoComplete="new-password"
                      disabled={changePassword.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revokeOtherSessions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={changePassword.isPending}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Encerrar outras sessões</FormLabel>
                    <FormDescription>
                      Desconectar todos os outros dispositivos após alterar a
                      senha
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={changePassword.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Alterando...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
