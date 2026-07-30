import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useChangePassword() {
  return useMutation({
    mutationFn: async (params: {
      currentPassword: string
      newPassword: string
      revokeOtherSessions: boolean
    }) => {
      const { data, error } = await authClient.changePassword({
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
        revokeOtherSessions: params.revokeOtherSessions,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao alterar senha')
    },
  })
}
