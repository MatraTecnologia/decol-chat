import { client } from '@workspace/api-client/client'

import { env } from '@/config/env'

client.setConfig({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
  // Faz as chamadas SDK lançarem em erro HTTP em vez de retornar { data, error },
  // para os erros propagarem ao estado de erro do React Query.
  throwOnError: true,
})

export { client }
