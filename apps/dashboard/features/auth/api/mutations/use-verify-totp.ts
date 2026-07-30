import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useVerifyTotp() {
  return useMutation({
    mutationFn: async (params: { code: string }) => {
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code: params.code,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Autenticação em duas etapas ativada!')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Código inválido')
    },
  })
}
