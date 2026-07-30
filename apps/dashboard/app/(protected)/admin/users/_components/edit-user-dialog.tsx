'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { PhoneInput } from '@workspace/ui/components/phone-input'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { authClient } from '@/lib/auth-client'
import { getUserAvatar } from '@/lib/get-user-avatar'
import type { UserRow } from './users-table'

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
})

type EditUserValues = z.infer<typeof editUserSchema>

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserRow | null
  onSuccess: () => void
}

export const EditUserDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserDialogProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: '', phone: '' },
  })

  useEffect(() => {
    if (open && user) {
      form.reset({
        name: user.name,
        phone: user.phone ?? '',
      })
    }
  }, [open, user, form])

  const handleUpdateAvatar = async () => {
    if (!user) return

    const avatarUrl = getUserAvatar(user.email, 128)

    setIsUpdatingAvatar(true)
    const { error } = await authClient.admin.updateUser({
      userId: user.id,
      data: { image: avatarUrl },
    })
    setIsUpdatingAvatar(false)

    if (error) {
      toast.error(error.message || 'Erro ao atualizar avatar')
      return
    }

    toast.success('Avatar atualizado com sucesso!')
    onSuccess()
  }

  const onSubmit = async (data: EditUserValues) => {
    if (!user) return

    setIsLoading(true)
    const { error } = await authClient.admin.updateUser({
      userId: user.id,
      data: {
        name: data.name,
        phone: data.phone || null,
      },
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao atualizar usuário')
      return
    }

    toast.success('Dados do usuário atualizados com sucesso!')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Edite as informações básicas de {user?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={user?.image || ''} alt={user?.name} />
            <AvatarFallback>
              {user?.name
                ?.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{user?.name}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdatingAvatar || isLoading}
              onClick={handleUpdateAvatar}
            >
              {isUpdatingAvatar ? (
                <Spinner className="mr-2" />
              ) : (
                <RefreshCw className="mr-2 size-3.5" />
              )}
              Atualizar avatar
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome completo"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <PhoneInput
                      international
                      limitMaxLength
                      defaultCountry="BR"
                      placeholder="Número de telefone"
                      countryCallingCodeEditable={false}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
