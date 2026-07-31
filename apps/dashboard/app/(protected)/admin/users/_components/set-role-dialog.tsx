'use client'

import { Briefcase, Eye, ShieldCheck, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { RoleType } from '@workspace/shared/roles'
import { ROLE_OPTIONS } from '@workspace/shared/roles'
import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@workspace/ui/components/radio-group'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import { authClient } from '@/lib/auth-client'

const iconMap = {
  ShieldCheck,
  Users,
  Briefcase,
  Eye,
  User,
} as const

interface SetRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string; role?: string } | null
  onSuccess: () => void
}

export function SetRoleDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: SetRoleDialogProps) {
  const [role, setRole] = useState<RoleType>(
    (user?.role as RoleType) || 'user',
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && user?.role) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(user.role as RoleType)
    }
  }, [open, user?.role])

  async function handleSubmit() {
    if (!user) return
    setIsLoading(true)
    const { error } = await authClient.admin.setRole({
      userId: user.id,
      role,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao alterar papel')
      return
    }

    toast.success('Papel alterado com sucesso!')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar papel</DialogTitle>
          <DialogDescription>
            Alterar o papel de <strong>{user?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={role}
          onValueChange={v => setRole(v as RoleType)}
          disabled={isLoading}
          className="grid grid-cols-2 gap-3"
        >
          {ROLE_OPTIONS.map(option => {
            const Icon = iconMap[option.icon as keyof typeof iconMap]
            return (
              <Label
                key={option.value}
                htmlFor={`set-role-${option.value}`}
                className="has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50"
              >
                <RadioGroupItem
                  value={option.value}
                  id={`set-role-${option.value}`}
                  className="sr-only"
                />
                <Icon className="text-muted-foreground size-5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {option.description}
                  </div>
                </div>
              </Label>
            )
          })}
        </RadioGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
