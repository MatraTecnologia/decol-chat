import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Contatos',
  description:
    'Base de contatos do WhatsApp: dados cadastrais, notas internas e histórico de atendimentos.',
}

const ContactsPage = () => {
  return <Client />
}

export default ContactsPage
