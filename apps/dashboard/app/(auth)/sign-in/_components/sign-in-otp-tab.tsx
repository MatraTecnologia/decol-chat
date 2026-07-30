'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Spinner } from '@workspace/ui/components/spinner'

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@workspace/ui/components/input-otp'

import { authClient } from '@/lib/auth-client'

const inputClass =
  'border-x-0 border-t-0 border-b border-border rounded-none bg-transparent px-0 py-2.5 text-sm focus-visible:ring-0 focus-visible:border-[#C8A86B] placeholder:text-muted-foreground/50 transition-colors'

const labelClass =
  'text-[10px] tracking-[0.15em] uppercase text-muted-foreground'

const submitButtonClass =
  'flex h-12 w-full cursor-pointer items-center justify-center rounded-none bg-[#0C0E10] text-sm font-medium tracking-[0.15em] text-white uppercase transition-all duration-300 hover:bg-[#C8A86B] hover:text-[#0C0E10] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#C8A86B] dark:text-[#0C0E10] dark:hover:bg-[#C8A86B]/80'

type Step = 'email' | 'otp'

export const SignInOtpTab = () => {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao enviar código')
      return
    }

    setStep('otp')
  }

  const handleSignIn = async (value?: string) => {
    const otpValue = value ?? otp
    if (otpValue.length !== 6) return

    setIsLoading(true)
    await authClient.signIn.emailOtp(
      { email: email.trim(), otp: otpValue },
      {
        onSuccess: ctx => {
          if (ctx.data.twoFactorRedirect) {
            router.push('/two-factor')
          } else {
            toast.success('Login realizado!')
            router.push('/dashboard')
          }
        },
        onError: ctx => {
          setIsLoading(false)
          toast.error(ctx.error.message || 'Código inválido ou expirado')
        },
      },
    )
  }

  const handleOtpChange = (value: string) => {
    setOtp(value)
    if (value.length === 6) {
      handleSignIn(value)
    }
  }

  const handleBackToEmail = () => {
    setOtp('')
    setStep('email')
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {step === 'email' ? (
          <motion.form
            key="email-step"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSendOtp}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="otp-email" className={labelClass}>
                Email
              </label>
              <input
                id="otp-email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                disabled={isLoading}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass + ' w-full outline-none'}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className={submitButtonClass}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Enviando...
                </span>
              ) : (
                'Enviar código'
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="otp-step"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <p
              className="text-muted-foreground text-sm"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Código enviado para{' '}
              <span className="text-foreground font-medium">{email}</span>
            </p>

            <div className="space-y-2">
              <p className={labelClass}>Código de 6 dígitos</p>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <button
              type="button"
              disabled={isLoading || otp.length !== 6}
              onClick={() => handleSignIn()}
              className={submitButtonClass}
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

            <button
              type="button"
              onClick={handleBackToEmail}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground w-full text-center text-[11px] transition-colors disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              ← Tentar outro email
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
