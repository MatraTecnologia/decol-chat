'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'
import { Textarea } from '@workspace/ui/components/textarea'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { authClient } from '@/lib/auth-client'

const durations = [
  { label: 'Permanente', value: '0' },
  { label: '1 dia', value: '86400' },
  { label: '7 dias', value: '604800' },
  { label: '30 dias', value: '2592000' },
]

interface BanUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string } | null
  onSuccess: () => void
}

export function BanUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: BanUserDialogProps) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('0')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit() {
    if (!user) return
    setIsLoading(true)

    const { error } = await authClient.admin.banUser({
      userId: user.id,
      banReason: reason.trim() || undefined,
      banExpiresIn: duration !== '0' ? Number(duration) : undefined,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message || 'Erro ao banir usuário')
      return
    }

    toast.success('Usuário banido com sucesso')
    setReason('')
    setDuration('0')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banir usuário</DialogTitle>
          <DialogDescription>
            Banir <strong>{user?.name}</strong> da plataforma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              placeholder="Motivo do banimento..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Duração</label>
            <Select
              value={duration}
              onValueChange={setDuration}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map(d => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Banindo...
              </>
            ) : (
              'Banir usuário'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
