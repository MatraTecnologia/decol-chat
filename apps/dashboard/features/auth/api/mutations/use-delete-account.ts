import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (params: { password: string }) => {
      const { data, error } = await authClient.deleteUser({
        password: params.password,
      })
      if (error) throw error
      return data
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir conta')
    },
  })
}
