import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'

interface UpdateProfileParams {
  name: string
  phone?: string
}

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: async (params: UpdateProfileParams) => {
      const { data, error } = await authClient.updateUser({
        name: params.name,
        phone: params.phone || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile')
    },
  })
}
