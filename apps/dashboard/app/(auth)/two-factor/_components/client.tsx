'use client'

import { motion } from 'motion/react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'

import { env } from '@/config/env'
import { authClient } from '@/lib/auth-client'

type Method = 'totp' | 'otp' | 'backup'

const inputClass =
  'border-x-0 border-t-0 border-b border-border rounded-none bg-transparent px-0 py-2.5 text-sm focus-visible:ring-0 focus-visible:border-[#C8A86B] placeholder:text-muted-foreground/50 transition-colors'

const labelClass =
  'text-[10px] tracking-[0.15em] uppercase text-muted-foreground'

const primaryBtnClass =
  'flex h-12 w-full cursor-pointer items-center justify-center rounded-none bg-[#0C0E10] text-sm font-medium uppercase tracking-[0.15em] text-white transition-all duration-300 hover:bg-[#C8A86B] hover:text-[#0C0E10] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#C8A86B] dark:text-[#0C0E10] dark:hover:bg-[#C8A86B]/80'

export const Client = () => {
  const [method, setMethod] = useState<Method>('totp')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)

  const handleVerifyTotp = async () => {
    if (!code.trim()) {
      toast.error('Digite o código de verificação')
      return
    }

    setIsLoading(true)
    const { error } = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Código inválido')
      return
    }

    toast.success('Verificação concluída!')
    window.location.href = `${env.NEXT_PUBLIC_BASE_URL}/dashboard`
  }

  const handleSendOtp = async () => {
    setIsLoading(true)
    const { error } = await authClient.twoFactor.sendOtp()
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao enviar código')
      return
    }

    toast.success('Código enviado para seu email!')
    setOtpSent(true)
  }

  const handleVerifyOtp = async () => {
    if (!code.trim()) {
      toast.error('Digite o código de verificação')
      return
    }

    setIsLoading(true)
    const { error } = await authClient.twoFactor.verifyOtp({
      code,
      trustDevice,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Código inválido')
      return
    }

    toast.success('Verificação concluída!')
    window.location.href = `${env.NEXT_PUBLIC_BASE_URL}/dashboard`
  }

  const handleVerifyBackup = async () => {
    if (!code.trim()) {
      toast.error('Digite o código de backup')
      return
    }

    setIsLoading(true)
    const { error } = await authClient.twoFactor.verifyBackupCode({
      code,
      trustDevice,
    })
    setIsLoading(false)

    if (error) {
      console.log(error)
      toast.error(error.message || 'Código inválido')
      return
    }

    toast.success('Verificação concluída!')
    window.location.href = `${env.NEXT_PUBLIC_BASE_URL}/dashboard`
  }

  const handleTabChange = (value: string) => {
    setMethod(value as Method)
    setCode('')
  }

  const descriptions: Record<Method, string> = {
    totp: 'Digite o código de 6 dígitos do seu app autenticador.',
    otp: 'Receba um código de verificação por email.',
    backup: 'Use um dos seus códigos de backup.',
  }

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border"
          style={{
            borderColor: '#C8A86B',
            backgroundColor: 'rgba(200,168,107,0.08)',
          }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: '#C8A86B' }} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-4 h-px w-8"
          style={{ backgroundColor: '#C8A86B' }}
        />
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-foreground text-3xl font-light tracking-tight"
          style={{ fontFamily: 'var(--font-cormorant)' }}
        >
          Verificação em duas etapas
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground mt-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          {descriptions[method]}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Tabs value={method} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="totp" className="text-xs">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              App
            </TabsTrigger>
            <TabsTrigger value="otp" className="text-xs">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-xs">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Backup
            </TabsTrigger>
          </TabsList>

          {/* TOTP */}
          <TabsContent value="totp" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="totp-code" className={labelClass}>
                Código do autenticador
              </Label>
              <Input
                id="totp-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={isLoading}
                autoFocus
                className={inputClass}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trust-totp"
                checked={trustDevice}
                onCheckedChange={v => setTrustDevice(v === true)}
              />
              <Label
                htmlFor="trust-totp"
                className="text-muted-foreground text-xs font-normal"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                Confiar neste dispositivo por 30 dias
              </Label>
            </div>
            <button
              type="button"
              className={primaryBtnClass}
              onClick={handleVerifyTotp}
              disabled={isLoading}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Verificando...
                </span>
              ) : (
                'Verificar'
              )}
            </button>
          </TabsContent>

          {/* OTP */}
          <TabsContent value="otp" className="space-y-6">
            {!otpSent ? (
              <button
                type="button"
                className="border-border flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-none border text-sm font-medium tracking-[0.15em] uppercase transition-all duration-300 hover:border-[#C8A86B] hover:text-[#C8A86B] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSendOtp}
                disabled={isLoading}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Enviando...
                  </span>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar código por email
                  </>
                )}
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp-code" className={labelClass}>
                    Código recebido por email
                  </Label>
                  <Input
                    id="otp-code"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trust-otp"
                    checked={trustDevice}
                    onCheckedChange={v => setTrustDevice(v === true)}
                  />
                  <Label
                    htmlFor="trust-otp"
                    className="text-muted-foreground text-xs font-normal"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Confiar neste dispositivo por 30 dias
                  </Label>
                </div>
                <button
                  type="button"
                  className={primaryBtnClass}
                  onClick={handleVerifyOtp}
                  disabled={isLoading}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Verificando...
                    </span>
                  ) : (
                    'Verificar'
                  )}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground w-full text-sm transition-colors"
                  onClick={() => {
                    setOtpSent(false)
                    setCode('')
                  }}
                  disabled={isLoading}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Reenviar código
                </button>
              </>
            )}
          </TabsContent>

          {/* Backup */}
          <TabsContent value="backup" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="backup-code" className={labelClass}>
                Código de backup
              </Label>
              <Input
                id="backup-code"
                placeholder="xxxxxxxx"
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={isLoading}
                autoFocus
                className={inputClass}
              />
            </div>
            <button
              type="button"
              className={primaryBtnClass}
              onClick={handleVerifyBackup}
              disabled={isLoading}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Verificando...
                </span>
              ) : (
                'Verificar'
              )}
            </button>
          </TabsContent>
        </Tabs>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
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
