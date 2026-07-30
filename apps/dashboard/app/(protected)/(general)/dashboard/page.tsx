import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your application dashboard',
}

const DashboardPage = () => {
  return <Client />
}

export default DashboardPage
