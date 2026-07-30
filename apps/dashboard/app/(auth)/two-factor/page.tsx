import { Metadata } from 'next'

import { Client } from './_components/client'

export const metadata: Metadata = {
  title: 'Two-Factor Verification',
  description: 'Complete two-factor verification to access your account',
}

const TwoFactorPage = () => {
  return <Client />
}

export default TwoFactorPage
