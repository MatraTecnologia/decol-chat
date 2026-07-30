'use client'

import { motion } from 'motion/react'

import { env } from '@/config/env'
import { ThemeToggle } from '@/components/theme-toggle'

export const AuthLayoutProviders = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Left panel — branding */}
      <div className="bg-primary relative hidden w-[45%] flex-col justify-between overflow-hidden lg:flex">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top: Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 p-10"
        >
          <span className="text-primary-foreground text-2xl font-bold tracking-tight">
            {env.NEXT_PUBLIC_APP_NAME}
          </span>
        </motion.div>

        {/* Center: Tagline */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="relative z-10 px-10"
        >
          <div className="bg-primary-foreground/20 mb-8 h-px w-12" />
          <h2 className="text-primary-foreground text-4xl leading-[1.15] font-light">
            Build your SaaS faster.
          </h2>
          <p className="text-primary-foreground/50 mt-6 text-sm leading-relaxed">
            A production-ready starter template with authentication, real-time
            updates, and everything you need to launch.
          </p>
        </motion.div>

        <div />
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 flex-col bg-[#FAFAF8] dark:bg-[#0F1011]">
        {/* Mobile logo */}
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <span className="text-foreground text-xl font-bold tracking-tight lg:hidden">
            {env.NEXT_PUBLIC_APP_NAME}
          </span>
          <ThemeToggle />
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-105"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
