import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  phone: z.string().optional(),
})

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>

/** @deprecated Use updateProfileSchema */
export const updateNameSchema = updateProfileSchema
/** @deprecated Use UpdateProfileFormValues */
export type UpdateNameFormValues = UpdateProfileFormValues

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
    revokeOtherSessions: z.boolean(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().min(1, 'Confirmation is required'),
})

export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>

export const validateDeleteConfirmation = (value: string): boolean => {
  return value === 'EXCLUIR'
}
