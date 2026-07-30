'use client'

import { motion } from 'motion/react'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

interface ErrorProps {
  reset: () => void
  error: Error & { digest?: string }
}

export default function Error({ error, reset }: ErrorProps) {
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
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CardTitle className="text-2xl font-bold tracking-tight">
              Algo deu errado
            </CardTitle>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CardDescription>
              Ocorreu um erro inesperado. Tente novamente ou volte para a página
              inicial.
            </CardDescription>
          </motion.div>
        </CardHeader>

        {error.message && (
          <CardContent>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-muted/50 rounded-lg p-4"
            >
              <p className="text-muted-foreground text-xs font-medium">
                Detalhes do erro:
              </p>
              <p className="text-destructive mt-1 font-mono text-sm">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-muted-foreground mt-2 text-xs">
                  ID: {error.digest}
                </p>
              )}
            </motion.div>
          </CardContent>
        )}

        <CardFooter>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex w-full flex-col gap-2 sm:flex-row"
          >
            <Button onClick={reset} className="flex-1">
              Tentar novamente
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/dashboard">Voltar ao início</Link>
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  )
}
