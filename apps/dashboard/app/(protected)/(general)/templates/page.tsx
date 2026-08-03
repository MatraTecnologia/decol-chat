import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Modelos',
  description:
    'Catálogo de modelos de mensagem do WhatsApp: rascunhos locais, envio para aprovação da Meta e histórico de revisões.',
}

const TemplatesPage = () => {
  return <Client />
}

export default TemplatesPage
