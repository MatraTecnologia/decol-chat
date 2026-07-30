'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'

import { SignInOtpTab } from './sign-in-otp-tab'
import { SignInPasswordTab } from './sign-in-password-tab'

export const Client = () => {
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
          Bem-vindo de volta
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-muted-foreground mt-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Escolha como deseja acessar sua conta
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="password">
          <TabsList className="border-border grid w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="password"
              className="text-muted-foreground data-[state=active]:text-foreground rounded-none bg-transparent pb-3 text-[10px] tracking-[0.15em] uppercase shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#C8A86B] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Senha
            </TabsTrigger>
            <TabsTrigger
              value="otp"
              className="text-muted-foreground data-[state=active]:text-foreground rounded-none bg-transparent pb-3 text-[10px] tracking-[0.15em] uppercase shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#C8A86B] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Código de email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-6">
            <SignInPasswordTab />
          </TabsContent>

          <TabsContent value="otp" className="mt-6">
            <SignInOtpTab />
          </TabsContent>
        </Tabs>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="text-muted-foreground mt-8 text-center text-sm"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        Não tem uma conta?{' '}
        <Link
          href="/sign-up"
          className="font-medium transition-colors"
          style={{ color: '#C8A86B' }}
        >
          Cadastre-se
        </Link>
      </motion.p>
    </div>
  )
}
