import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useDisableTwoFactor() {
  return useMutation({
    mutationFn: async (params: { password: string }) => {
      const { data, error } = await authClient.twoFactor.disable({
        password: params.password,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Autenticação em duas etapas desativada')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao desativar 2FA')
    },
  })
}
