import { createAuthClient } from 'better-auth/react'

import {
  adminClient,
  emailOTPClient,
  inferAdditionalFields,
  twoFactorClient,
} from 'better-auth/client/plugins'

import { ac, admin, user } from '@workspace/shared/permissions'

import { env } from '@/config/env'

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    adminClient({
      ac,
      roles: { admin, user },
    }),
    twoFactorClient(),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        phone: { type: 'string', required: false },
      },
    }),
  ],
})
