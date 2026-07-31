import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { TooltipProvider } from '@workspace/ui/components/tooltip'

import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { MessageNotifications } from '@/components/message-notifications'
import { RealtimeInvalidation } from '@/components/realtime-invalidation'
import { SessionUnavailable } from '@/components/session-unavailable'
import { getServerSession } from '@/lib/auth-server'
import { ModalProvider, QueryProvider, SocketProvider } from '@/providers'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  const result = await getServerSession()

  // Falha de API não é usuário deslogado — limpar aqui destruiria sessão válida.
  if (result.status === 'error') {
    return <SessionUnavailable />
  }

  if (result.status === 'unauthenticated') {
    redirect('/api/clear-session')
  }

  if (result.user.role === 'user') {
    redirect('/not-authorized')
  }

  return (
    <QueryProvider>
      <SocketProvider>
        <RealtimeInvalidation />
        <MessageNotifications />
        <TooltipProvider>
          <ModalProvider />
          <NuqsAdapter>
            <SidebarProvider defaultOpen={defaultOpen}>
              <AppSidebar />

              {/* h-svh + overflow-hidden tiram o scroll do body: o header fica
                  fixo e cada tela rola no próprio container. É o que permite a
                  Inbox dar scroll independente por coluna. */}
              <SidebarInset className="h-svh overflow-hidden">
                <ImpersonationBanner />
                <Header />
                <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          </NuqsAdapter>
        </TooltipProvider>
      </SocketProvider>
    </QueryProvider>
  )
}
