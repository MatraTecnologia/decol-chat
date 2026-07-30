'use client'

import { motion } from 'motion/react'
import { ShieldXIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Button } from '@workspace/ui/components/button'

import { FullScreenLoader } from '@/components/full-screen-loader'
import { useUserRole } from '@/hooks'

interface AdminGateProps {
  children: React.ReactNode
}

export const AdminGate = ({ children }: AdminGateProps) => {
  const router = useRouter()
  const { hasRole, isPending } = useUserRole()

  const isAdmin = hasRole('admin')

  useEffect(() => {
    if (!isPending && !isAdmin) {
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isPending, isAdmin, router])

  if (isPending) {
    return <FullScreenLoader label="Verificando permissões..." />
  }

  if (!isAdmin) {
    return (
      <div className="bg-background flex size-full flex-1 flex-col items-center justify-center gap-4 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="bg-destructive/10 flex size-16 items-center justify-center rounded-full"
        >
          <ShieldXIcon className="text-destructive size-8" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h2 className="text-foreground text-lg font-semibold">
            Acesso restrito
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Redirecionando para o dashboard...
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            Ir para o Dashboard
          </Button>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}
