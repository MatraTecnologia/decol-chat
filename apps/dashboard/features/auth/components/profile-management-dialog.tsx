'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { UAParser } from 'ua-parser-js'

import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Globe,
  Key,
  Laptop,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Pencil,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { PhoneInput } from '@workspace/ui/components/phone-input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/popover'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
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

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'

import { authClient } from '@/lib/auth-client'
import { getUserAvatar } from '@/lib/get-user-avatar'

import { useListSessions } from '../api/query'
import { useProfileModal } from '../hooks/use-profile-modal'
import { updateProfileSchema, type UpdateProfileFormValues } from '../schemas'
import { BackupCodesDialog } from './backup-codes-dialog'
import { ChangePasswordDialog } from './change-password-dialog'
import { DeleteAccountDialog } from './delete-account-dialog'
import { DisableTwoFactorDialog } from './disable-two-factor-dialog'
import { EnableTwoFactorDialog } from './enable-two-factor-dialog'

import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSendVerificationEmail,
  useSignOut,
  useUpdateProfile,
} from '../api/mutations'

// --- Main Dialog ---

export const ProfileManagementDialog = () => {
  const { isOpen, onOpenChange } = useProfileModal()
  const { data: session } = authClient.useSession()

  if (!session?.user) return null

  const user = session.user
  const currentSessionToken = session.session.token

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            Gerencie suas informações pessoais e configurações de conta.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList variant="line">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="sessions">Sessões</TabsTrigger>
            <TabsTrigger value="account">Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <ProfileTab user={user} />
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <SecurityTab twoFactorEnabled={user.twoFactorEnabled ?? false} />
          </TabsContent>

          <TabsContent value="sessions" className="mt-4 space-y-4">
            <SessionsTab currentSessionToken={currentSessionToken} />
          </TabsContent>

          <TabsContent value="account" className="mt-4 space-y-4">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// --- Profile Tab ---

interface ProfileTabProps {
  user: {
    name: string
    email: string
    emailVerified: boolean
    createdAt: Date
    image?: string | null
    phone?: string | null
  }
}

const ProfileTab = ({ user }: ProfileTabProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const updateProfile = useUpdateProfile()
  const sendVerificationEmail = useSendVerificationEmail()

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const memberSince = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.createdAt))

  const handleUpdateAvatar = async () => {
    const avatarUrl = getUserAvatar(user.email, 128)

    setIsUpdatingAvatar(true)
    const { error } = await authClient.updateUser({ image: avatarUrl })
    setIsUpdatingAvatar(false)

    if (error) {
      toast.error(error.message || 'Erro ao atualizar avatar')
      return
    }

    toast.success('Avatar atualizado com sucesso!')
  }

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? '',
    },
  })

  const onSubmit = (data: UpdateProfileFormValues) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        setIsEditing(false)
      },
    })
  }

  const handleCancel = () => {
    form.reset({
      name: user.name,
      phone: user.phone ?? '',
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Info */}
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <div className="relative cursor-pointer">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={user.image ?? ''}
                  alt={user.name ?? 'Avatar'}
                  draggable={false}
                />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="bg-background border-border absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border">
                <Pencil className="size-3" />
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72" side="right" align="start">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Alterar foto de perfil</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Seu avatar é gerenciado pelo{' '}
                  <a
                    href="https://gravatar.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Gravatar
                  </a>
                  . Para alterá-lo, atualize seu perfil no Gravatar associando
                  uma imagem ao email <strong>{user.email}</strong>.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isUpdatingAvatar}
                onClick={handleUpdateAvatar}
              >
                {isUpdatingAvatar ? (
                  <>
                    <Spinner className="mr-2 size-3" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 size-3" />
                    Sincronizar avatar
                  </>
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="space-y-1">
          <p className="text-lg font-medium">{user.name}</p>
          <div className="flex items-center gap-1.5">
            <Mail className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-sm">{user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <BadgeCheck className="h-3 w-3" />
                Verificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Mail className="h-3 w-3" />
                Não verificado
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              Membro desde {memberSince}
            </span>
          </div>
        </div>
      </div>

      {!user.emailVerified && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => sendVerificationEmail.mutate({ email: user.email })}
          disabled={sendVerificationEmail.isPending}
        >
          {sendVerificationEmail.isPending ? (
            <>
              <Spinner className="mr-2" />
              Enviando...
            </>
          ) : (
            'Reenviar email de verificação'
          )}
        </Button>
      )}

      <Separator />

      {/* Profile edit */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-end gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome"
                      disabled={!isEditing || updateProfile.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    'Salvar'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  disabled={updateProfile.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

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
                    disabled={!isEditing || updateProfile.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}

// --- Security Tab ---

interface SecurityTabProps {
  twoFactorEnabled: boolean
}

const SecurityTab = ({ twoFactorEnabled }: SecurityTabProps) => {
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false)
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [isBackupCodesDialogOpen, setIsBackupCodesDialogOpen] = useState(false)

  return (
    <>
      <div className="space-y-6">
        {/* Password Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Senha</p>
              <p className="text-muted-foreground text-xs">
                Última alteração desconhecida
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setIsPasswordDialogOpen(true)}
          >
            Alterar senha
          </Button>
        </div>

        <Separator />

        {/* Two-Factor Authentication Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                Autenticação de dois fatores
              </p>
              <Badge variant={twoFactorEnabled ? 'default' : 'outline'}>
                {twoFactorEnabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
          </div>
          {twoFactorEnabled ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBackupCodesDialogOpen(true)}
              >
                Códigos de backup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDisableDialogOpen(true)}
              >
                Desativar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setIsEnableDialogOpen(true)}
            >
              Ativar
            </Button>
          )}
        </div>
      </div>

      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />

      <EnableTwoFactorDialog
        open={isEnableDialogOpen}
        onOpenChange={setIsEnableDialogOpen}
        onSuccess={() => window.location.reload()}
      />

      <DisableTwoFactorDialog
        open={isDisableDialogOpen}
        onOpenChange={setIsDisableDialogOpen}
        onSuccess={() => window.location.reload()}
      />

      <BackupCodesDialog
        open={isBackupCodesDialogOpen}
        onOpenChange={setIsBackupCodesDialogOpen}
      />
    </>
  )
}

// --- Sessions Tab ---

const parseUserAgent = (ua: string | null | undefined) => {
  if (!ua) return null
  const { browser, os, device } = UAParser(ua)

  const browserLabel = browser.name
    ? `${browser.name}${browser.major ? ` ${browser.major}` : ''}`
    : null
  const osLabel = os.name
    ? `${os.name}${os.version ? ` ${os.version}` : ''}`
    : null

  return {
    browser: browserLabel,
    os: osLabel,
    deviceType: device.type || 'desktop',
  }
}

const getDeviceIcon = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return Smartphone
    case 'tablet':
      return Tablet
    case 'console':
    case 'smarttv':
      return Monitor
    default:
      return Laptop
  }
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes}m`
  if (hours < 24) return `há ${hours}h`
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

interface SessionsTabProps {
  currentSessionToken: string
}

const SessionsTab = ({ currentSessionToken }: SessionsTabProps) => {
  const { data: sessions, isLoading } = useListSessions()
  const revokeSession = useRevokeSession()
  const revokeOtherSessions = useRevokeOtherSessions()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          <Globe className="text-muted-foreground h-6 w-6" />
        </div>
        <p className="text-muted-foreground text-sm">
          Nenhuma sessão ativa encontrada.
        </p>
      </div>
    )
  }

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.token === currentSessionToken) return -1
    if (b.token === currentSessionToken) return 1
    return 0
  })

  const otherSessionsCount = sessions.filter(
    s => s.token !== currentSessionToken,
  ).length

  return (
    <div className="space-y-4">
      {otherSessionsCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {sessions.length}{' '}
            {sessions.length === 1 ? 'sessão ativa' : 'sessões ativas'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => revokeOtherSessions.mutate()}
            disabled={revokeOtherSessions.isPending}
          >
            {revokeOtherSessions.isPending ? (
              <>
                <Spinner className="mr-1.5 h-3 w-3" />
                Revogando...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3 w-3" />
                Revogar outras
              </>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {sortedSessions.map(session => {
          const ua = parseUserAgent(session.userAgent)
          const DeviceIcon = ua ? getDeviceIcon(ua.deviceType) : Globe
          const isCurrentSession = session.token === currentSessionToken
          const isRevoking =
            revokeSession.isPending &&
            revokeSession.variables?.token === session.token

          return (
            <div
              key={session.token}
              className={`group relative rounded-lg border p-4 transition-colors ${
                isCurrentSession
                  ? 'border-primary/20 bg-primary/3'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Device icon */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isCurrentSession
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <DeviceIcon className="h-4.5 w-4.5" />
                </div>

                {/* Session info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {ua?.browser ?? 'Dispositivo desconhecido'}
                    </span>
                    {isCurrentSession && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Atual
                      </span>
                    )}
                  </div>

                  {ua?.os && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {ua.os}
                    </p>
                  )}

                  {/* Metadata badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {session.ipAddress && (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                        <MapPin className="h-3 w-3" />
                        {session.ipAddress}
                      </span>
                    )}
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(session.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Revoke button */}
                {!isCurrentSession && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() =>
                      revokeSession.mutate({ token: session.token })
                    }
                    disabled={isRevoking}
                  >
                    {isRevoking ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Account Tab ---

const AccountTab = () => {
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const signOut = useSignOut()

  const handleLogout = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        router.push('/sign-in')
      },
    })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Sign out */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Sair</p>
            <p className="text-muted-foreground text-xs">
              Encerre sua sessão atual
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={signOut.isPending}
            className="w-full sm:w-auto"
          >
            {signOut.isPending ? (
              <>
                <Spinner className="mr-2" />
                Saindo...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Danger zone */}
        <div className="border-destructive/50 space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="text-destructive text-sm font-medium">
              Zona de perigo
            </h3>
            <p className="text-muted-foreground text-sm">
              Ações irreversíveis que afetam sua conta
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Excluir conta</p>
              <p className="text-muted-foreground text-xs">
                Exclua permanentemente sua conta e todos os dados
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Excluir minha conta
            </Button>
          </div>
        </div>
      </div>

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  )
}
