/**
 * Dispara o sync inicial dos dados do app do celular (coexistence).
 *
 * Vive numa fila e não inline na rota de onboarding porque a janela para pedir
 * esses dados é de 24h e só existe uma vez: uma instabilidade momentânea da
 * Meta não pode queimá-la sem retentativa.
 */
import type { FastifyInstance } from 'fastify'

import { createQueue, createWorker } from '@/lib/queue.js'
import { getAccountById } from '@/lib/whatsapp/connection.js'
import { requestSmbAppData } from '@/lib/whatsapp/graph-client.js'

export interface WhatsappSmbSyncJobData {
  accountId: string
}

export const whatsappSmbSyncQueue =
  createQueue<WhatsappSmbSyncJobData>('whatsapp-smb-sync')

export const registerWhatsappSmbSyncJob = (app: FastifyInstance) => {
  const worker = createWorker<WhatsappSmbSyncJobData>(
    'whatsapp-smb-sync',
    async job => {
      const account = await getAccountById(job.data.accountId)

      // Conta desativada entre o enfileiramento e a execução: nada a pedir.
      if (!account) return

      // Contatos antes do histórico: as mensagens referenciam gente que os
      // contatos nomeiam, e a ordem inversa deixaria tudo sem nome até o fim.
      await requestSmbAppData(
        account.accessToken,
        account.phoneNumberId,
        'smb_app_state_sync',
      )

      await requestSmbAppData(
        account.accessToken,
        account.phoneNumberId,
        'history',
      )
    },
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Job whatsapp-smb-sync falhou')
  })

  app.addHook('onClose', async () => {
    await worker.close()
    await whatsappSmbSyncQueue.close()
  })
}
