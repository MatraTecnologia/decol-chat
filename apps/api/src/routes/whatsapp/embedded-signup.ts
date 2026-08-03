import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { env } from '@/env.js'
import { whatsappSmbSyncQueue } from '@/jobs/whatsapp-smb-sync.js'
import { requireRole } from '@/lib/auth-guard.js'
import {
  updateConnectionMeta,
  upsertConnection,
} from '@/lib/whatsapp/connection.js'
import { isEncryptionConfigured } from '@/lib/whatsapp/crypto.js'
import {
  GraphApiError,
  getPhoneNumberInfo,
  subscribeApp,
} from '@/lib/whatsapp/graph-client.js'
import { exchangeCodeForToken } from '@/lib/whatsapp/oauth.js'

const bodySchema = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
})

const responseSchema = z.object({
  phoneNumberId: z.string(),
  wabaId: z.string(),
  displayPhoneNumber: z.string().nullable(),
  verifiedName: z.string().nullable(),
})

const embeddedSignupRoutes: FastifyPluginAsyncZod = async app => {
  app.post(
    '/connection/embedded-signup',
    {
      schema: {
        operationId: 'connectWhatsappEmbeddedSignup',
        tags: ['WhatsApp'],
        summary: 'Conclui o Embedded Signup e grava a conexão (coexistence)',
        body: bodySchema,
        response: { 200: responseSchema },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.badRequest(
          'WHATSAPP_ENCRYPTION_KEY não configurada — defina a chave no .env da API',
        )
      }

      const { META_APP_ID: appId, META_APP_SECRET: appSecret } = env
      if (!appId || !appSecret) {
        return reply.badRequest(
          'META_APP_ID / META_APP_SECRET não configuradas — defina as envs do Embedded Signup no .env da API',
        )
      }

      const { code, phoneNumberId, wabaId } = request.body

      try {
        const accessToken = await exchangeCodeForToken({ appId, appSecret, code })

        // Coexistence NÃO chama /register: o número já está registrado pelo app
        // do celular e registrar aqui o tiraria de lá.
        const account = await upsertConnection({
          accessToken,
          phoneNumberId,
          wabaId,
        })

        // Idempotência defensiva — o Embedded Signup já assina o app na WABA, e
        // a assinatura dos fields é configuração de app no App Dashboard.
        await subscribeApp(accessToken, wabaId)

        // Bloqueante de propósito: `display_phone_number` é o MSISDN da empresa
        // e é o que classifica direção no backfill de histórico (Fase 3).
        const info = await getPhoneNumberInfo(accessToken, phoneNumberId)

        await updateConnectionMeta({
          displayPhoneNumber: info.display_phone_number ?? null,
          verifiedName: info.verified_name ?? null,
          qualityRating: info.quality_rating ?? null,
          lastCheckedAt: new Date(),
        })

        // A janela para pedir os dados do app é de 24h e não se repete — o
        // enfileiramento vem logo após a conta existir, não no fim do handler.
        await whatsappSmbSyncQueue.add('smb-sync', { accountId: account.id })

        app.emitRealtimeEvent({
          entity: 'whatsappConnection',
          action: 'updated',
          entityId: phoneNumberId,
        })

        return {
          phoneNumberId,
          wabaId,
          displayPhoneNumber: info.display_phone_number ?? null,
          verifiedName: info.verified_name ?? null,
        }
      } catch (error) {
        if (!(error instanceof GraphApiError)) throw error

        const message = error.code
          ? `${error.message} (código ${error.code})`
          : error.message

        return error.status < 500
          ? reply.badRequest(message)
          : reply.badGateway(message)
      }
    },
  )
}

export default embeddedSignupRoutes
