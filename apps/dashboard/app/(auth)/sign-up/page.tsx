import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create an account to continue',
}

const Page = () => {
  return <Client />
}

export default Page
