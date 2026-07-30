import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.signOut()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Você saiu da sua conta')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sair')
    },
  })
}
