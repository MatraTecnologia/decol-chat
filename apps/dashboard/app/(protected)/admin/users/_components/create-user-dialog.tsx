'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Briefcase, Eye, ShieldCheck, User, Users, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ROLE_OPTIONS, ROLES } from '@workspace/shared/roles'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { PasswordInput } from '@workspace/ui/components/password-input'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import {
  RadioGroup,
  RadioGroupItem,
} from '@workspace/ui/components/radio-group'

import { PhoneInput } from '@workspace/ui/components/phone-input'

import { authClient } from '@/lib/auth-client'
import { getUserAvatar } from '@/lib/get-user-avatar'

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

const iconMap = {
  ShieldCheck,
  Users,
  Briefcase,
  Eye,
  User,
} as const

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.email('Email inválido').trim(),
  password: z.string().trim().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  role: z.enum(ROLES),
  phone: z.string().trim().optional(),
  emailVerified: z.boolean(),
})

type CreateUserValues = z.infer<typeof createUserSchema>

interface CreateUserDialogProps {
  children: React.ReactNode
  onSuccess: () => void
}

export function CreateUserDialog({
  children,
  onSuccess,
}: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
      phone: '',
      emailVerified: false,
    },
  })

  const password = useWatch({ control: form.control, name: 'password' })
  const passwordStrength = useMemo(
    () => getPasswordStrength(password || ''),
    [password],
  )

  async function handleGeneratePassword() {
    const newPassword = generatePassword()
    form.setValue('password', newPassword, { shouldValidate: true })
    await navigator.clipboard.writeText(newPassword)
    toast.success('Senha gerada e copiada para a área de transferência!')
  }

  async function onSubmit(data: CreateUserValues) {
    const avatarUrl = getUserAvatar(data.email, 128)

    setIsLoading(true)
    const { error } = await authClient.admin.createUser({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      data: {
        image: avatarUrl,
        phone: data.phone || undefined,
        emailVerified: data.emailVerified,
      },
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao criar usuário')
      return
    }

    toast.success('Usuário criado com sucesso!')
    form.reset()
    setOpen(false)
    onSuccess()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        setOpen(value)
        if (!value) form.reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>
            Crie uma nova conta de usuário na plataforma.
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
                      placeholder="Nome completo"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="usuario@email.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <PhoneInput
                      international
                      limitMaxLength
                      defaultCountry="BR"
                      placeholder="Número de telefone"
                      countryCallingCodeEditable={false}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Senha</FormLabel>
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
                  {password && password.length > 0 && (
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                      className="grid grid-cols-2 gap-3"
                    >
                      {ROLE_OPTIONS.map(option => {
                        const Icon =
                          iconMap[option.icon as keyof typeof iconMap]
                        return (
                          <Label
                            key={option.value}
                            htmlFor={`role-${option.value}`}
                            className="has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50"
                          >
                            <RadioGroupItem
                              value={option.value}
                              id={`role-${option.value}`}
                              className="sr-only"
                            />
                            <Icon className="text-muted-foreground size-5 shrink-0" />
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium">
                                {option.label}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {option.description}
                              </div>
                            </div>
                          </Label>
                        )
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailVerified"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        id="emailVerified"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="emailVerified"
                      className="cursor-pointer font-normal"
                    >
                      Marcar email como verificado
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Criando...
                </>
              ) : (
                'Criar usuário'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
