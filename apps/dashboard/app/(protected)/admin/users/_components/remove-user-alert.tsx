'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'

import { authClient } from '@/lib/auth-client'

interface RemoveUserAlertProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string } | null
  onSuccess: () => void
}

export function RemoveUserAlert({
  open,
  onOpenChange,
  user,
  onSuccess,
}: RemoveUserAlertProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm() {
    if (!user) return
    setIsLoading(true)
    const { error } = await authClient.admin.removeUser({
      userId: user.id,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao remover usuário')
      return
    }

    toast.success('Usuário removido com sucesso')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover <strong>{user?.name}</strong>? Esta
            ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Removendo...
              </>
            ) : (
              'Remover usuário'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
