import { useQuery } from '@tanstack/react-query'

import { authClient } from '@/lib/auth-client'

export function useListSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) throw error
      return data ?? []
    },
  })
}
