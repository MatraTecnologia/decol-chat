import type { Message } from '../types'

/**
 * A mensagem enviada pelo próprio atendente volta pelo socket e duplicaria na
 * thread. `waMessageId` é null enquanto ela está PENDING, então a chave cai
 * para o `id` local — que é o mesmo da bolha otimista.
 */
export const messageKey = (message: Message) => message.waMessageId ?? message.id

export const dedupeMessages = (messages: Message[]) => {
  const seen = new Set<string>()

  return messages.filter(message => {
    const key = messageKey(message)
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

/**
 * A thread é ordenada do mais recente para o mais antigo (o cursor pagina para
 * trás), então mensagem nova entra no topo da primeira página.
 */
export const prependMessage = (messages: Message[], incoming: Message) =>
  dedupeMessages([incoming, ...messages])
