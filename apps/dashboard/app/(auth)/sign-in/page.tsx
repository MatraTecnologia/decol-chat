import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your account to continue',
}

const Page = () => {
  return <Client />
}

export default Page
