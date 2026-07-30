import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { redirect } from 'next/navigation'

import { getServerSession } from '@/lib/auth-server'
import { AuthLayoutProviders } from './_components/auth-layout-provider'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const result = await getServerSession()

  // Só sessão confirmada redireciona. Em `error` ou `unauthenticated`, falha
  // aberto e renderiza o form — a rota é pública e tudo atrás dela é validado
  // no backend. Ver docs/better-auth-production-playbook.md §3.
  if (result.status === 'authenticated') {
    redirect(result.user.role === 'user' ? '/not-authorized' : '/dashboard')
  }

  return (
    <div className={`${cormorant.variable} ${dmSans.variable}`}>
      <AuthLayoutProviders>{children}</AuthLayoutProviders>
    </div>
  )
}
