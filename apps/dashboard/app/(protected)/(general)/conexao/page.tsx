import { Metadata } from 'next'

import { AdminGate } from '@/components/admin-gate'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Conexão',
  description:
    'Bancada de integração com a WhatsApp Cloud API: credenciais, webhook e testes ponta a ponta.',
}

const ConexaoPage = () => {
  return (
    <AdminGate>
      <Client />
    </AdminGate>
  )
}

export default ConexaoPage
