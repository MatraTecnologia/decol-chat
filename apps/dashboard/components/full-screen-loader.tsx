'use client'

import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'

interface FullScreenLoaderProps {
  label?: string
}

export const FullScreenLoader = ({ label }: FullScreenLoaderProps) => {
  return (
    <div className="bg-background flex size-full flex-1 flex-col items-center justify-center gap-4 p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <Loader2 className="text-primary h-8 w-8" />
        </motion.div>
      </motion.div>

      {label && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm font-medium"
        >
          {label}
        </motion.p>
      )}
    </div>
  )
}
