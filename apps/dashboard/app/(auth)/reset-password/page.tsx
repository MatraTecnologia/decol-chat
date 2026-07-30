import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your account',
}

const Page = () => {
  return <Client />
}

export default Page
