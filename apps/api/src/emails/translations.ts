export const getEmailT = (appName: string) =>
  ({
    'pt-BR': {
      greeting: (firstName?: string) => (firstName ? `Olá, ${firstName}!` : 'Olá!'),
      copyright: (year: number) => `© ${year} ${appName}. Todos os direitos reservados.`,
      verification: {
        preview: `Verifique seu email para ativar sua conta no ${appName}`,
        heading: 'Verifique seu email',
        body: `Obrigado por se cadastrar no ${appName}. Para começar a usar sua conta, confirme seu endereço de email clicando no botão abaixo.`,
        button: 'Verificar email',
        ignore: `Se você não criou uma conta no ${appName}, pode ignorar este email com segurança.`,
      },
      resetPassword: {
        preview: `Redefina sua senha no ${appName}`,
        heading: 'Redefinir sua senha',
        body: 'Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.',
        button: 'Redefinir senha',
        ignore:
          'Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha permanecerá a mesma.',
      },
      resetConfirmation: {
        preview: 'Sua senha foi alterada com sucesso',
        heading: 'Senha alterada com sucesso',
        body: 'Sua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.',
        ignore: 'Se você não realizou esta alteração, entre em contato com nosso suporte imediatamente.',
      },
      twoFactorOtp: {
        preview: `Seu código de verificação no ${appName}`,
        heading: 'Código de verificação',
        body: 'Use o código abaixo para completar seu login.',
        ignore: 'Este código expira em 3 minutos. Se você não tentou fazer login, ignore este email.',
      },
    },
    en: {
      greeting: (firstName?: string) => (firstName ? `Hi, ${firstName}!` : 'Hi!'),
      copyright: (year: number) => `© ${year} ${appName}. All rights reserved.`,
      verification: {
        preview: `Verify your email to activate your ${appName} account`,
        heading: 'Verify your email',
        body: `Thank you for signing up for ${appName}. To start using your account, please confirm your email address by clicking the button below.`,
        button: 'Verify email',
        ignore: `If you didn't create a ${appName} account, you can safely ignore this email.`,
      },
      resetPassword: {
        preview: `Reset your ${appName} password`,
        heading: 'Reset your password',
        body: 'We received a request to reset the password for your account. Click the button below to create a new password.',
        button: 'Reset password',
        ignore:
          "If you didn't request a password reset, you can safely ignore this email. Your password will remain the same.",
      },
      resetConfirmation: {
        preview: 'Your password has been changed successfully',
        heading: 'Password changed successfully',
        body: 'Your password has been changed successfully. You can now log in with your new password.',
        ignore: "If you didn't make this change, please contact our support immediately.",
      },
      twoFactorOtp: {
        preview: `Your ${appName} verification code`,
        heading: 'Verification code',
        body: 'Use the code below to complete your login.',
        ignore: "This code expires in 3 minutes. If you didn't try to log in, ignore this email.",
      },
    },
  }) as const

export type EmailLocale = 'pt-BR' | 'en'
