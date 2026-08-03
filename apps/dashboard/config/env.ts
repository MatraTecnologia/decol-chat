import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    APP_NAME: z.string().default('web'),
  },
  client: {
    // App metadata (optional with defaults)
    NEXT_PUBLIC_APP_NAME: z.string().default('SaaS App'),
    NEXT_PUBLIC_APP_DESCRIPTION: z
      .string()
      .default('Full-stack SaaS starter template'),
    NEXT_PUBLIC_APP_KEYWORDS: z.string().default('saas, nextjs, turborepo'),
    NEXT_PUBLIC_APP_CREATOR: z.string().default(''),
    NEXT_PUBLIC_COMPANY_NAME: z.string().default(''),

    // URLs
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_BASE_URL: z.url(),
    NEXT_PUBLIC_COOKIE_DOMAIN: z.string().optional(),

    // Embedded Signup (Coexistence)
    NEXT_PUBLIC_META_APP_ID: z.string().trim().min(1).optional(),
    NEXT_PUBLIC_META_ES_CONFIG_ID: z.string().trim().min(1).optional(),

    // SEO
    NEXT_PUBLIC_INDEXABLE: z
      .string()
      .default('false')
      .transform(v => v === 'true'),
    NEXT_PUBLIC_GOOGLE_VERIFICATION: z.string().default(''),
    NEXT_PUBLIC_BING_VERIFICATION: z.string().default(''),
  },
  runtimeEnv: {
    // Server
    APP_NAME: process.env.APP_NAME,

    // Client
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
    NEXT_PUBLIC_APP_KEYWORDS: process.env.NEXT_PUBLIC_APP_KEYWORDS,
    NEXT_PUBLIC_APP_CREATOR: process.env.NEXT_PUBLIC_APP_CREATOR,
    NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
    NEXT_PUBLIC_META_ES_CONFIG_ID: process.env.NEXT_PUBLIC_META_ES_CONFIG_ID,
    NEXT_PUBLIC_INDEXABLE: process.env.NEXT_PUBLIC_INDEXABLE,
    NEXT_PUBLIC_GOOGLE_VERIFICATION:
      process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    NEXT_PUBLIC_BING_VERIFICATION: process.env.NEXT_PUBLIC_BING_VERIFICATION,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
})
