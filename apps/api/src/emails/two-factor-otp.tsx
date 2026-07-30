import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  render,
} from 'react-email'

import { getEmailT, type EmailLocale } from './translations.js'

import {
  container,
  footer,
  h1,
  hr,
  logo,
  logoSection,
  main,
  text,
  textMuted,
} from './styles.js'

const otpCode = {
  backgroundColor: '#f4f4f5',
  borderRadius: '8px',
  padding: '16px 24px',
  textAlign: 'center' as const,
  margin: '0 0 32px',
}

const otpText = {
  fontSize: '32px',
  fontWeight: '700' as const,
  letterSpacing: '6px',
  color: '#1a1a1a',
  margin: '0',
  fontFamily: "'Courier New', Courier, monospace",
}

export async function renderTwoFactorOtpEmail(
  otp: string,
  userName?: string,
  locale?: string,
  appName?: string,
): Promise<string> {
  const name = appName ?? 'SaaS App'
  const t = getEmailT(name)[(locale as EmailLocale) ?? 'pt-BR'] ?? getEmailT(name)['pt-BR']
  const firstName = userName?.split(' ')[0]

  return await render(
    <Html>
      <Head />
      <Preview>{t.twoFactorOtp.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logo}>{name}</Text>
          </Section>

          <Heading style={h1}>{t.twoFactorOtp.heading}</Heading>

          <Text style={text}>
            {t.greeting(firstName)} {t.twoFactorOtp.body}
          </Text>

          <Section style={otpCode}>
            <Text style={otpText}>{otp}</Text>
          </Section>

          <Text style={textMuted}>{t.twoFactorOtp.ignore}</Text>

          <Hr style={hr} />

          <Text style={footer}>{t.copyright(new Date().getFullYear())}</Text>
        </Container>
      </Body>
    </Html>,
  )
}
