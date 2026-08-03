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

/**
 * Troca a bolha já renderizada pela versão nova (mudança de status). Devolve
 * `null` quando a mensagem não está na página, para o chamador saber que não
 * há o que atualizar ali — e não recriar o array à toa.
 */
export const replaceMessage = (messages: Message[], incoming: Message) => {
  const index = messages.findIndex(
    message => messageKey(message) === messageKey(incoming),
  )

  if (index === -1) return null

  const next = [...messages]
  next[index] = incoming

  return next
}
