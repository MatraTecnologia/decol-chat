import 'dotenv/config'

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.url().trim(),
    BETTER_AUTH_SECRET: z.string().trim().min(32),
    APP_NAME: z.string().trim().min(1).default('SaaS App'),
    BETTER_AUTH_URL: z.url().trim(),
    SITE_URL: z.url().trim(),
    TRUSTED_ORIGINS: z
      .string()
      .trim()
      .transform(s => s.split(',').map(o => o.trim())),
    RESEND_API_KEY: z.string().trim().min(1),
    EMAIL_FROM: z.string().trim().min(1),
    PORT: z.coerce.number().default(3333),
    HOST: z.string().trim().default('0.0.0.0'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // AI
    OPENAI_API_KEY: z.string().trim().min(1),

    // Cloudflare R2
    R2_ENDPOINT: z.url().trim(),
    R2_ACCESS_KEY_ID: z.string().trim().min(1),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
    R2_PRIVATE_BUCKET_NAME: z.string().trim().min(1),

    // Health / Under Pressure
    UNDER_PRESSURE_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),

    // Cookie (cross-subdomain sharing for multiple apps)
    COOKIE_DOMAIN: z.string().trim().optional(),

    // Redis
    REDIS_URL: z.url().trim(),

    // Bull Board (HTTP Basic Auth)
    BULL_BOARD_USER: z.string().trim().min(1).optional(),
    BULL_BOARD_PASSWORD: z.string().trim().min(1).optional(),

    // WhatsApp Cloud API
    // Ambas opcionais: a API precisa subir em ambientes que não usam WhatsApp.
    WHATSAPP_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
    // Aceita string vazia porque a base do túnel costuma ficar em branco no .env.
    PUBLIC_WEBHOOK_BASE_URL: z.url().trim().or(z.literal('')).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
