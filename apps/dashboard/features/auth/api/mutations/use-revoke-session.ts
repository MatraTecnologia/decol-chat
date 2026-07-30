import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { token: string }) => {
      const { data, error } = await authClient.revokeSession({
        token: params.token,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Sessão encerrada')
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao encerrar sessão')
    },
  })
}
