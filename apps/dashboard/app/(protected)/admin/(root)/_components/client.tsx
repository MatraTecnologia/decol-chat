'use client'

import { motion } from 'motion/react'
import { HardHat, Ruler, Wrench } from 'lucide-react'

export const Client = () => {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
      {/* Blueprint grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Diagonal accent lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="bg-primary/5 absolute top-1/4 -left-20 h-px w-150 rotate-12"
        />
        <motion.div
          initial={{ x: '200%' }}
          animate={{ x: '-100%' }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
            delay: 2,
          }}
          className="bg-primary/5 absolute -right-20 bottom-1/3 h-px w-125 -rotate-6"
        />
      </div>

      {/* Floating tool icons */}
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="text-muted-foreground/10 absolute top-[15%] left-[12%]"
      >
        <Wrench className="size-16 -rotate-45 sm:size-20" strokeWidth={1} />
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0], rotate: [0, -3, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        className="text-muted-foreground/10 absolute right-[10%] bottom-[20%]"
      >
        <Ruler className="size-14 rotate-12 sm:size-18" strokeWidth={1} />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Hard hat icon with pulse ring */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          className="relative mb-8"
        >
          <div className="bg-primary/5 border-primary/10 relative flex size-24 items-center justify-center rounded-2xl border sm:size-28">
            <HardHat
              className="text-primary size-11 sm:size-13"
              strokeWidth={1.5}
            />
          </div>

          {/* Subtle pulse */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="border-primary/20 absolute inset-0 rounded-2xl border"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-foreground mb-3 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Em construção
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-muted-foreground mb-10 max-w-md text-base leading-relaxed sm:text-lg"
        >
          Estamos preparando algo incrível para você.
          <br />
          <span className="text-muted-foreground/70 text-sm">
            Volte em breve.
          </span>
        </motion.p>

        {/* Animated progress bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.5 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-muted relative h-1.5 w-48 overflow-hidden rounded-full sm:w-56"
        >
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="from-primary/80 via-primary to-primary/80 absolute inset-y-0 w-1/3 rounded-full bg-linear-to-r"
          />
        </motion.div>
      </div>
    </div>
  )
}
