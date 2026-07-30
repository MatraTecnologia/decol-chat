'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { PasswordInput } from '@workspace/ui/components/password-input'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

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

const signInSchema = z.object({
  email: z.email('Email inválido').trim(),
  password: z.string().trim().min(1, 'Senha obrigatória'),
})

type SignInFormValues = z.infer<typeof signInSchema>

const inputClass =
  'border-x-0 border-t-0 border-b border-border rounded-none bg-transparent px-0 py-2.5 text-sm focus-visible:ring-0 focus-visible:border-[#C8A86B] placeholder:text-muted-foreground/50 transition-colors'

const labelClass =
  'text-[10px] tracking-[0.15em] uppercase text-muted-foreground'

export const SignInPasswordTab = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleResendVerification = async () => {
    const email = form.getValues('email')
    if (!email) {
      toast.error('Digite seu email')
      return
    }

    setIsResending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${env.NEXT_PUBLIC_BASE_URL}/sign-in`,
    })
    setIsResending(false)

    if (error) {
      toast.error(error.message || 'Erro ao enviar email')
    } else {
      toast.success(
        'Email de verificação enviado! Verifique sua caixa de entrada.',
      )
    }
  }

  const onSubmit = async (data: SignInFormValues) => {
    await authClient.signIn.email(
      {
        email: data.email,
        password: data.password,
        callbackURL: `${env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      },
      {
        onRequest: () => setIsLoading(true),
        onSuccess: ctx => {
          if (ctx.data.twoFactorRedirect) {
            router.push('/two-factor')
          } else {
            toast.success('Login realizado com sucesso!')
            router.push('/dashboard')
          }
        },
        onError: ctx => {
          setIsLoading(false)
          if (ctx.error.message === 'Email not verified') {
            setEmailNotVerified(true)
          } else {
            toast.error(ctx.error.message || 'Erro ao fazer login')
          }
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
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
                    onChange={e => {
                      field.onChange(e)
                      if (emailNotVerified) setEmailNotVerified(false)
                    }}
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
          transition={{ delay: 0.15 }}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={labelClass}>Senha</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-[10px] transition-colors"
                    style={{ color: '#C8A86B' }}
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="current-password"
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

        {emailNotVerified && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Email não verificado</AlertTitle>
              <AlertDescription className="mt-2">
                <p>Você precisa verificar seu email antes de fazer login.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleResendVerification}
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <Spinner className="mr-2" />
                      Enviando...
                    </>
                  ) : (
                    'Reenviar email de verificação'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </motion.div>
      </form>
    </Form>
  )
}
