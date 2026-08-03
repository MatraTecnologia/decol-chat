'use client'

import { motion } from 'motion/react'
import { Plug } from 'lucide-react'

import { ConnectionStatus } from './connection-status'
import { EmbeddedSignupButton } from './embedded-signup-button'
import { ReadinessPanel } from './readiness-panel'
import { SetupGuide } from './setup-guide'
import { TestMessageForm } from './test-message-form'
import { WebhookConsole } from './webhook-console'
import { WebhookPanel } from './webhook-panel'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export const Client = () => {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div {...fadeUp} className="flex items-center gap-3">
        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Plug className="text-primary size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Conexão
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bancada de integração com a WhatsApp Cloud API — configure as
            credenciais, exponha o webhook e prove o ciclo completo sem sair
            desta tela.
          </p>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <ReadinessPanel />
      </motion.div>

      <motion.div
        {...fadeUp}
        transition={{ delay: 0.2 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <EmbeddedSignupButton />
        <ConnectionStatus />
        <WebhookPanel />
        <TestMessageForm />
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <WebhookConsole />
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <SetupGuide />
      </motion.div>
    </div>
  )
}
