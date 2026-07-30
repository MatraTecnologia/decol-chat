'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Input } from '@workspace/ui/components/input'
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

import { env } from '@/config/env'
import { authClient } from '@/lib/auth-client'
import { getUserAvatar } from '@/lib/get-user-avatar'

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.email('Email inválido').trim(),
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

type SignUpFormValues = z.infer<typeof signUpSchema>

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

export const Client = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
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

  const onSubmit = async (data: SignUpFormValues) => {
    const avatarUrl = getUserAvatar(data.email, 128)

    await authClient.signUp.email(
      {
        email: data.email,
        password: data.password,
        name: data.name,
        image: avatarUrl,
        callbackURL: `${env.NEXT_PUBLIC_BASE_URL}/sign-in`,
      },
      {
        onRequest: () => setIsLoading(true),
        onSuccess: () => {
          setIsLoading(false)
          setIsSuccess(true)
          toast.success('Conta criada! Verifique seu email para confirmar.')
        },
        onError: ctx => {
          setIsLoading(false)
          toast.error(ctx.error.message || 'Erro ao criar conta')
        },
      },
    )
  }

  if (isSuccess) {
    return (
      <div className="w-full text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border"
          style={{
            borderColor: '#C8A86B',
            backgroundColor: 'rgba(200,168,107,0.08)',
          }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: '#C8A86B' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div
            className="mx-auto mb-5 h-px w-8"
            style={{ backgroundColor: '#C8A86B' }}
          />
          <h2
            className="text-foreground text-3xl font-light tracking-tight"
            style={{ fontFamily: 'var(--font-cormorant)' }}
          >
            Conta criada com sucesso!
          </h2>
          <p
            className="text-muted-foreground mt-3 text-sm leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Enviamos um email de confirmação para você. Verifique sua caixa de
            entrada e clique no link para ativar sua conta.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 flex flex-col gap-4"
        >
          <Link
            href="/sign-in"
            className="flex h-12 items-center justify-center rounded-none text-sm font-medium tracking-[0.15em] uppercase transition-all duration-300"
            style={{
              backgroundColor: '#0C0E10',
              color: '#FAFAF8',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            Ir para o login
          </Link>
          <p
            className="text-muted-foreground text-sm"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Não recebeu o email?{' '}
            <button
              type="button"
              onClick={() => toast.info('Funcionalidade em desenvolvimento')}
              className="font-medium transition-colors"
              style={{ color: '#C8A86B' }}
            >
              Reenviar
            </button>
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Heading */}
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
          Crie sua conta
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-muted-foreground mt-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Preencha os dados abaixo para começar
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Nome completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome"
                      autoComplete="name"
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      autoComplete="email"
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className={labelClass}>Senha</FormLabel>
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
            transition={{ delay: 0.35 }}
          >
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Confirmar senha</FormLabel>
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
              className="flex h-12 w-full cursor-pointer items-center justify-center rounded-none bg-[#0C0E10] text-sm font-medium tracking-[0.15em] text-white uppercase transition-all duration-300 hover:bg-[#C8A86B] hover:text-[#0C0E10] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#C8A86B] dark:text-[#0C0E10] dark:hover:bg-[#C8A86B]/80"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Criando conta...
                </span>
              ) : (
                'Criar conta'
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
        Já tem uma conta?{' '}
        <Link
          href="/sign-in"
          className="font-medium transition-colors"
          style={{ color: '#C8A86B' }}
        >
          Entre
        </Link>
      </motion.p>
    </div>
  )
}
