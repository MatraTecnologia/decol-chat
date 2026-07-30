import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { env } from '@/config/env'
import { authClient } from '@/lib/auth-client'

export function useSendVerificationEmail() {
  return useMutation({
    mutationFn: async (params: { email: string }) => {
      const { data, error } = await authClient.sendVerificationEmail({
        email: params.email,
        callbackURL: `${env.NEXT_PUBLIC_BASE_URL}/sign-in`,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success(
        'E-mail de verificação enviado! Verifique sua caixa de entrada.',
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar email')
    },
  })
}
