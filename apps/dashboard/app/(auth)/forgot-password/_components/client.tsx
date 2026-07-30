'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Input } from '@workspace/ui/components/input'
import { Spinner } from '@workspace/ui/components/spinner'

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

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

const inputClass =
  'border-x-0 border-t-0 border-b border-border rounded-none bg-transparent px-0 py-2.5 text-sm focus-visible:ring-0 focus-visible:border-[#C8A86B] placeholder:text-muted-foreground/50 transition-colors'

const labelClass =
  'text-[10px] tracking-[0.15em] uppercase text-muted-foreground'

export const Client = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setSubmittedEmail(data.email)
    const { error } = await authClient.requestPasswordReset(
      {
        email: data.email,
        redirectTo: `${env.NEXT_PUBLIC_BASE_URL}/reset-password`,
      },
      {
        onRequest: () => setIsLoading(true),
      },
    )

    setIsLoading(false)
    if (error) {
      toast.error(error.message || 'Erro ao enviar email de recuperação')
    } else {
      setIsSuccess(true)
    }
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
          <Mail className="h-7 w-7" style={{ color: '#C8A86B' }} />
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
            Verifique seu email
          </h2>
          <p
            className="text-muted-foreground mt-3 text-sm leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Enviamos um link de recuperação para{' '}
            <span className="text-foreground font-medium">
              {submittedEmail}
            </span>
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
            className="flex h-12 items-center justify-center rounded-none bg-[#0C0E10] text-sm font-medium tracking-[0.15em] text-white uppercase transition-all duration-300 hover:bg-[#C8A86B] hover:text-[#0C0E10] dark:bg-[#C8A86B] dark:text-[#0C0E10] dark:hover:bg-[#C8A86B]/80"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Voltar para o login
          </Link>
          <p
            className="text-muted-foreground text-sm"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Não recebeu o email? Verifique o spam ou{' '}
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false)
                form.reset()
              }}
              className="font-medium transition-colors"
              style={{ color: '#C8A86B' }}
            >
              tente novamente
            </button>
          </p>
        </motion.div>
      </div>
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
          Esqueceu sua senha?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-muted-foreground mt-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Digite seu email para receber o link de recuperação
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                  Enviando...
                </span>
              ) : (
                'Enviar link'
              )}
            </button>
          </motion.div>
        </form>
      </Form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mt-8 text-center text-sm"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        Lembrou sua senha?{' '}
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
