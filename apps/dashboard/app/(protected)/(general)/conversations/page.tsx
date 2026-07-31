import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Conversas',
  description:
    'Atendimento conversacional via WhatsApp: fila, histórico e contexto do contato.',
}

const ConversationsPage = () => {
  return <Client />
}

export default ConversationsPage
