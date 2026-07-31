/** Janela em que a Meta aceita texto livre, contada da última mensagem recebida. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Fora da janela a Meta recusa texto livre (131047) — só template passa.
 * A leitura (`canSendFreeText`) e o envio usam esta mesma conta para não
 * divergirem: o que o cliente vê habilitado é o que o servidor aceita.
 */
export const isWithinWindow = (lastInboundAt: Date | null) =>
  lastInboundAt !== null &&
  Date.now() - lastInboundAt.getTime() < MESSAGING_WINDOW_MS

export const windowExpiresAt = (lastInboundAt: Date | null) =>
  lastInboundAt ? new Date(lastInboundAt.getTime() + MESSAGING_WINDOW_MS) : null
