'use client'

import { motion } from 'motion/react'
import { FileQuestion } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="bg-card/80 w-full max-w-md border-0 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
          >
            <FileQuestion className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CardTitle className="text-2xl font-bold tracking-tight">
              Página não encontrada
            </CardTitle>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CardDescription>
              A página que você está procurando não existe ou foi movida.
            </CardDescription>
          </motion.div>
        </CardHeader>

        <CardFooter>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex w-full flex-col gap-2 sm:flex-row"
          >
            <Button className="flex-1" asChild>
              <Link href="/dashboard">Voltar ao início</Link>
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => window.history.back()}
            >
              Voltar
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  )
}
