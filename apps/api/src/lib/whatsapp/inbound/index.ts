/**
 * Ingestão dos eventos que a Meta entrega no webhook.
 *
 * Vive fora de `jobs/` de propósito: o arquivo do job abre a conexão do BullMQ
 * no import, e quem só quer processar um payload (worker, teste) não precisa
 * dela. O worker é uma casca fina em volta de `processInboundPayload`.
 */
import { handleMessagesChange } from './messages.js'
import { extractChanges } from './payload.js'
import { resolveAccountForChange } from './resolve-account.js'
import type { InboundContext } from './shared.js'

export type { InboundContext } from './shared.js'

export const processInboundPayload = async (
  app: InboundContext,
  payload: unknown,
) => {
  for (const change of extractChanges(payload)) {
    const account = await resolveAccountForChange(change)

    // Número que não é desta instalação não é erro retentável.
    if (!account) {
      app.log.warn(
        { field: change.field, wabaId: change.wabaId },
        'Evento do WhatsApp para conta desconhecida — descartado',
      )
      continue
    }

    if (change.field === 'messages') {
      await handleMessagesChange(app, account.id, change.value)
      continue
    }

    // Field sem parser é registrado com o corpo inteiro: é este log que
    // fornece o formato real dos eventos de coexistence para a Fase 2.
    app.log.info(
      { field: change.field, value: change.value },
      'Evento do WhatsApp sem handler — payload registrado para análise',
    )
  }
}
