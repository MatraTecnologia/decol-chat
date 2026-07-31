import { i18n } from '@better-auth/i18n'
import { redisStorage } from '@better-auth/redis-storage'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, emailOTP, openAPI, twoFactor } from 'better-auth/plugins'

import { getEmailLocale } from '@/emails/get-email-locale.js'
import { env } from '@/env.js'
import { AUTH_COOKIE_PREFIX } from '@workspace/shared/auth-cookie'
import { en, ptBR } from '@/shared/i18n.js'
import { recordAudit } from './audit.js'
import { sendEmail } from './email.js'
import { prisma } from './prisma.js'
import { redis } from './redis.js'

import {
  ac,
  admin as adminRole,
  agent as agentRole,
  manager as managerRole,
  user as userRole,
  viewer as viewerRole,
} from '@workspace/shared/permissions'

// Lazy-load email templates to avoid jiti resolution issues with @better-auth/cli
const emails = () => import('@/emails/index.js')

export const auth = betterAuth({
  appName: env.APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Redis como secondary storage acelera as leituras de sessão e o rate limit.
  // `storeSessionInDatabase` + `verification.storeInDatabase` (abaixo) mantêm o
  // Postgres como fonte da verdade — o Redis é só acelerador, então um flush ou
  // eviction NÃO desloga ninguém. Ver docs/better-auth-production-playbook.md §5.
  secondaryStorage: redisStorage({ client: redis, keyPrefix: 'better-auth:' }),
  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: !!env.COOKIE_DOMAIN,
      domain: env.COOKIE_DOMAIN,
    },
    // sameSite: 'lax' funciona quando dashboard e API são same-site, ou seja,
    // compartilham o mesmo eTLD+1 (ex.: subdomínios irmãos no easypanel.host, ou
    // app.exemplo.com + api.exemplo.com — neste último, setar COOKIE_DOMAIN).
    //
    // ⚠️ Se um dia dashboard e API ficarem em domínios eTLD+1 DIFERENTES
    // (ex.: app.exemplo.com + api.outro-dominio.com), o navegador NÃO envia o
    // cookie no fetch cross-site com 'lax' e o login quebra. Nesse caso, trocar:
    //   sameSite: 'none', secure: true  (secure é obrigatório com 'none')
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
    },
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'secondary-storage',
    customRules: {
      '/get-session': false,
      '/ok': false,

      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/send-verification-email': { window: 60, max: 3 },
      '/two-factor/send-otp': { window: 30, max: 3 },
      '/email-otp/send-otp': { window: 60, max: 3 },
      '/email-otp/sign-in': { window: 30, max: 5 },

      '/sign-in/email': { window: 30, max: 5 },
      '/sign-in/social': { window: 30, max: 5 },
      '/two-factor/verify-totp': { window: 30, max: 5 },
      '/verify-password': { window: 30, max: 5 },
      '/reset-password': { window: 60, max: 5 },
      '/change-password': { window: 60, max: 5 },

      '/delete-user': { window: 60, max: 3 },
      '/change-email': { window: 60, max: 3 },
    },
  },
  session: {
    // Sessões mais velhas que 1h exigem reautenticação para ações sensíveis
    // (ex.: delete-user), mitigando abuso de sessão sequestrada.
    freshAge: 60 * 60,
    // Com secondaryStorage, sem isto as sessões viveriam SÓ no Redis. Mantém o
    // Postgres como fonte da verdade (audit hook + cleanup job + listagem admin).
    storeSessionInDatabase: true,
    // Cacheia a sessão num cookie assinado curto → corta o hit no get-session a
    // cada hard load. maxAge baixo limita o atraso na propagação de revogação/role.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  verification: {
    // Idem: sem isto, verification records (OTP, reset de senha, verify-email)
    // iriam só pro Redis e evaporariam num flush/eviction.
    storeInDatabase: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
    changeEmail: {
      enabled: false,
    },
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      ac,
      roles: {
        admin: adminRole,
        manager: managerRole,
        agent: agentRole,
        viewer: viewerRole,
        user: userRole,
      },
    }),
    openAPI(),
    i18n({
      defaultLocale: 'pt-BR',
      detection: ['cookie', 'header'],
      translations: {
        en,
        'pt-BR': ptBR,
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        const locale = getEmailLocale(
          (ctx as { request?: Request } | undefined)?.request,
        )
        const { renderTwoFactorOtpEmail } = await emails()
        const html = await renderTwoFactorOtpEmail(
          otp,
          email,
          locale,
          env.APP_NAME,
        )
        const subject =
          type === 'sign-in'
            ? locale === 'en'
              ? `Your access code - ${env.APP_NAME}`
              : `Seu código de acesso - ${env.APP_NAME}`
            : type === 'email-verification'
              ? locale === 'en'
                ? `Verify your email - ${env.APP_NAME}`
                : `Verifique seu email - ${env.APP_NAME}`
              : locale === 'en'
                ? `Reset password - ${env.APP_NAME}`
                : `Redefinir senha - ${env.APP_NAME}`
        await sendEmail({ to: email, subject, html })
      },
    }),
    twoFactor({
      issuer: env.APP_NAME,
      backupCodeOptions: {},
      otpOptions: {
        sendOTP: async ({ user, otp }, ctx) => {
          const locale = getEmailLocale(
            (ctx as { request?: Request } | undefined)?.request,
          )
          const { renderTwoFactorOtpEmail } = await emails()
          const html = await renderTwoFactorOtpEmail(
            otp,
            user.name,
            locale,
            env.APP_NAME,
          )
          await sendEmail({
            to: user.email,
            subject:
              locale === 'en'
                ? `Your verification code - ${env.APP_NAME}`
                : `Seu código de verificação - ${env.APP_NAME}`,
            html,
          })
        },
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }, request) => {
      const locale = getEmailLocale(request)
      const { renderResetPasswordEmail } = await emails()
      const html = await renderResetPasswordEmail(
        url,
        user.name,
        locale,
        env.APP_NAME,
      )
      await sendEmail({
        to: user.email,
        subject:
          locale === 'en'
            ? `Reset your password - ${env.APP_NAME}`
            : `Redefina sua senha - ${env.APP_NAME}`,
        html,
      })
    },
    onPasswordReset: async ({ user }, request) => {
      const locale = getEmailLocale(request)
      const { renderPasswordResetConfirmationEmail } = await emails()
      const html = await renderPasswordResetConfirmationEmail(
        user.name,
        locale,
        env.APP_NAME,
      )
      await sendEmail({
        to: user.email,
        subject:
          locale === 'en'
            ? `Password changed successfully - ${env.APP_NAME}`
            : `Senha alterada com sucesso - ${env.APP_NAME}`,
        html,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }, request) => {
      const locale = getEmailLocale(request)
      const { renderVerificationEmail } = await emails()
      const html = await renderVerificationEmail(
        url,
        user.name,
        locale,
        env.APP_NAME,
      )
      await sendEmail({
        to: user.email,
        subject:
          locale === 'en'
            ? `Verify your email - ${env.APP_NAME}`
            : `Verifique seu email - ${env.APP_NAME}`,
        html,
      })
    },
  },
  databaseHooks: {
    user: {
      delete: {
        async before() {
          // Add cleanup logic here when domain models reference userId
        },
        async after(user) {
          await recordAudit({ event: 'user.deleted', userId: user.id })
        },
      },
      create: {
        async before(data) {
          const count = await prisma.user.count()
          if (count === 0) {
            return { data: { ...data, role: 'admin' } }
          }
        },
        async after(user) {
          await recordAudit({ event: 'user.created', userId: user.id })
        },
      },
      update: {
        async after(user) {
          await recordAudit({
            event: 'user.updated',
            userId: user.id,
            metadata: { role: user.role ?? null, banned: user.banned ?? null },
          })
        },
      },
    },
    session: {
      create: {
        async after(session) {
          await recordAudit({
            event: 'session.created',
            userId: session.userId,
            ip: session.ipAddress,
            userAgent: session.userAgent,
          })
        },
      },
    },
  },
})

// Rodar apos alguma alteração de plugin que alterar o banco de dados
// pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts
