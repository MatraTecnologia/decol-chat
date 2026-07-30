'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { PasswordInput } from '@workspace/ui/components/password-input'
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

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'

import { useDeleteAccount } from '../api/mutations'
import {
  deleteAccountSchema,
  validateDeleteConfirmation,
  type DeleteAccountFormValues,
} from '../schemas'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const DeleteAccountDialog = ({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) => {
  const router = useRouter()
  const deleteAccount = useDeleteAccount()

  const form = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      password: '',
      confirmation: '',
    },
  })

  const onSubmit = (data: DeleteAccountFormValues) => {
    if (!validateDeleteConfirmation(data.confirmation)) {
      form.setError('confirmation', {
        message: 'Digite EXCLUIR para confirmar',
      })
      return
    }

    deleteAccount.mutate(
      { password: data.password },
      {
        onSuccess: () => {
          router.push('/')
        },
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <AlertDialogTitle className="text-center">
            Excluir conta permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Esta ação é irreversível. Todos os seus dados serão permanentemente
            excluídos e não poderão ser recuperados.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirme sua senha</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="********"
                      autoComplete="current-password"
                      disabled={deleteAccount.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Digite <span className="font-mono font-bold">EXCLUIR</span>{' '}
                    para confirmar
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="EXCLUIR"
                      autoComplete="off"
                      disabled={deleteAccount.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={deleteAccount.isPending}
              >
                {deleteAccount.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir minha conta'
                )}
              </Button>
              <AlertDialogCancel
                className="w-full"
                disabled={deleteAccount.isPending}
              >
                Cancelar
              </AlertDialogCancel>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
