/**
 * O gerador do hey-api só carimba `tags` na query key das operações não
 * infinitas — a variante infinita nasce sem elas. Sem esse mapa a lista de
 * conversas e a thread (as duas únicas telas com `useInfiniteQuery`) ficariam
 * de fora de qualquer invalidação por tag, do socket ou de `onSuccess`.
 */
const OPERATION_TAGS: Record<string, readonly string[]> = {
  listConversations: ['Conversations'],
  listMessages: ['Messages'],
  listContacts: ['Contacts'],
  listUsers: ['Users'],
  listWhatsappTemplates: ['WhatsAppTemplates'],
}

export const queryKeyTags = (
  queryKey: readonly unknown[],
): readonly string[] | undefined => {
  const key = queryKey[0]
  if (typeof key !== 'object' || key === null) return undefined

  const { _id, tags } = key as { _id?: string; tags?: readonly string[] }

  if (tags) return tags

  return _id ? OPERATION_TAGS[_id] : undefined
}

export const matchesQueryTags = (
  queryKey: readonly unknown[],
  tags: readonly string[],
) => {
  const queryTags = queryKeyTags(queryKey)
  if (!queryTags) return false

  return queryTags.some(tag => tags.includes(tag))
}
