import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.revokeOtherSessions()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Todas as outras sessões foram encerradas')
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao encerrar sessões')
    },
  })
}
