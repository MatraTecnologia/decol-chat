'use client'

import { motion } from 'motion/react'
import { LogOut, ShieldX } from 'lucide-react'
import { redirect, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { authClient } from '@/lib/auth-client'

const NotAuthorizedPage = () => {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  if (session && session.user.role !== 'user') {
    redirect('/dashboard')
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="bg-card/80 w-full max-w-md border-0 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
          >
            <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CardTitle className="text-2xl font-bold tracking-tight">
              Acesso não autorizado
            </CardTitle>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CardDescription>
              Sua conta não tem permissão para acessar o dashboard.
            </CardDescription>
          </motion.div>
        </CardHeader>

        <CardFooter>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full"
          >
            <Button className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default NotAuthorizedPage
