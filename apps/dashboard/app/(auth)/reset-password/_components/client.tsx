'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PasswordInput } from '@workspace/ui/components/password-input'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { authClient } from '@/lib/auth-client'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .trim()
      .min(8, 'Senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().trim(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

const getPasswordStrength = (
  password: string,
): { score: number; label: string; color: string } => {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Fraca', color: 'bg-destructive' }
  if (score <= 2) return { score, label: 'Razoável', color: 'bg-orange-500' }
  if (score <= 3) return { score, label: 'Boa', color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Forte', color: 'bg-[#C8A86B]' }
  return { score, label: 'Muito forte', color: 'bg-[#C8A86B]' }
}

const generatePassword = (length = 16): string => {
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

const inputClass =
  'border-x-0 border-t-0 border-b border-border rounded-none bg-transparent px-0 py-2.5 text-sm focus-visible:ring-0 focus-visible:border-[#C8A86B] placeholder:text-muted-foreground/50 transition-colors'

const labelClass =
  'text-[10px] tracking-[0.15em] uppercase text-muted-foreground'

const primaryBtnClass =
  'flex h-12 w-full cursor-pointer items-center justify-center rounded-none bg-[#0C0E10] text-sm font-medium uppercase tracking-[0.15em] text-white transition-all duration-300 hover:bg-[#C8A86B] hover:text-[#0C0E10] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#C8A86B] dark:text-[#0C0E10] dark:hover:bg-[#C8A86B]/80'

type StateCardProps = {
  icon: React.ReactNode
  iconColor: string
  borderColor: string
  bgColor: string
  title: string
  description: string
  children: React.ReactNode
}

const StateCard = ({
  icon,
  iconColor,
  borderColor,
  bgColor,
  title,
  description,
  children,
}: StateCardProps) => (
  <div className="w-full text-center">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border"
      style={{ borderColor, backgroundColor: bgColor }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
    </motion.div>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div
        className="mx-auto mb-5 h-px w-8"
        style={{ backgroundColor: borderColor }}
      />
      <h2
        className="text-foreground text-3xl font-light tracking-tight"
        style={{ fontFamily: 'var(--font-cormorant)' }}
      >
        {title}
      </h2>
      <p
        className="text-muted-foreground mt-3 text-sm leading-relaxed"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        {description}
      </p>
    </motion.div>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mt-8 flex flex-col gap-3"
    >
      {children}
    </motion.div>
  </div>
)

export const Client = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const password = useWatch({ control: form.control, name: 'password' })
  const passwordStrength = useMemo(
    () => getPasswordStrength(password || ''),
    [password],
  )

  const handleGeneratePassword = async () => {
    const newPassword = generatePassword()
    form.setValue('password', newPassword, { shouldValidate: true })
    form.setValue('confirmPassword', newPassword, { shouldValidate: true })

    await navigator.clipboard.writeText(newPassword)
    toast.success('Senha gerada e copiada para a área de transferência!')
  }

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) {
      setError('Token de recuperação não encontrado')
      return
    }

    await authClient.resetPassword(
      {
        newPassword: data.password,
        token,
      },
      {
        onRequest: () => setIsLoading(true),
        onSuccess: () => {
          setIsLoading(false)
          setIsSuccess(true)
          toast.success('Senha redefinida com sucesso!')
        },
        onError: ctx => {
          setIsLoading(false)
          setError(ctx.error.message || 'Erro ao redefinir senha')
        },
      },
    )
  }

  if (!token || error) {
    return (
      <StateCard
        icon={<AlertCircle className="h-7 w-7" />}
        iconColor="#ef4444"
        borderColor="rgba(239,68,68,0.5)"
        bgColor="rgba(239,68,68,0.06)"
        title={error ? 'Erro ao redefinir senha' : 'Link inválido'}
        description={
          error
            ? error
            : 'O link de recuperação de senha é inválido ou expirou.'
        }
      >
        <Link
          href="/forgot-password"
          className={primaryBtnClass}
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Solicitar novo link
        </Link>
        <Link
          href="/sign-in"
          className="text-muted-foreground text-sm transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)', color: '#C8A86B' }}
        >
          Voltar para o login
        </Link>
      </StateCard>
    )
  }

  if (isSuccess) {
    return (
      <StateCard
        icon={<CheckCircle2 className="h-7 w-7" />}
        iconColor="#C8A86B"
        borderColor="#C8A86B"
        bgColor="rgba(200,168,107,0.08)"
        title="Senha redefinida!"
        description="Sua senha foi alterada. Agora você pode fazer login com sua nova senha."
      >
        <Link
          href="/sign-in"
          className={primaryBtnClass}
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Ir para o login
        </Link>
      </StateCard>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 h-px w-8"
          style={{ backgroundColor: '#C8A86B' }}
        />
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="text-foreground text-3xl font-light tracking-tight"
          style={{ fontFamily: 'var(--font-cormorant)' }}
        >
          Redefinir senha
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-muted-foreground mt-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Digite sua nova senha abaixo
        </motion.p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className={labelClass}>Nova senha</FormLabel>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-[10px] tracking-widest uppercase transition-colors disabled:opacity-50"
                      style={{
                        color: '#C8A86B',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                    >
                      <Wand2 className="size-3" />
                      Gerar senha
                    </button>
                  </div>
                  <FormControl>
                    <PasswordInput
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className={inputClass}
                      {...field}
                    />
                  </FormControl>
                  {password && password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5 pt-1"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(level => (
                          <div
                            key={level}
                            className={cn(
                              'h-0.5 flex-1 transition-colors',
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
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        Força da senha: {passwordStrength.label}
                      </p>
                    </motion.div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>
                    Confirmar nova senha
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className={inputClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnClass}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Redefinindo...
                </span>
              ) : (
                'Redefinir senha'
              )}
            </button>
          </motion.div>
        </form>
      </Form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground mt-8 text-center text-sm"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        <Link
          href="/sign-in"
          className="font-medium transition-colors"
          style={{ color: '#C8A86B' }}
        >
          Voltar para o login
        </Link>
      </motion.p>
    </div>
  )
}
