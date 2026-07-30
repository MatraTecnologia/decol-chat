import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Usuários',
  description: 'Gerenciamento de usuários do painel administrativo',
}

const AdminUsersPage = () => {
  return <Client />
}

export default AdminUsersPage
