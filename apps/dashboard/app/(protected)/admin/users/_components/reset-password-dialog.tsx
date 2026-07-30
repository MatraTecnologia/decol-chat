'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@workspace/ui/components/button'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { authClient } from '@/lib/auth-client'

function getPasswordStrength(password: string) {
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

function generatePassword(length = 16) {
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

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string } | null
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: ResetPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
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

  async function onSubmit(data: ResetPasswordValues) {
    if (!user) return
    setIsLoading(true)
    const { error } = await authClient.admin.setUserPassword({
      userId: user.id,
      newPassword: data.newPassword,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao redefinir senha')
      return
    }

    toast.success('Senha redefinida com sucesso!')
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) form.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Redefinir a senha de <strong>{user?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      disabled={isLoading}
                      className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="size-3" />
                      Gerar senha
                    </button>
                  </div>
                  <FormControl>
                    <PasswordInput
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  {newPassword && newPassword.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
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
                  <FormLabel>Confirmar senha</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
