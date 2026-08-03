import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Acompanhamento',
  description: 'Volume, tempo de resposta e desempenho do atendimento',
}

const DashboardPage = () => {
  return <Client />
}

export default DashboardPage
