import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Recover access to your account',
}

const Page = () => {
  return <Client />
}

export default Page
