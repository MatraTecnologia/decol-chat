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

export async function renderPasswordResetConfirmationEmail(
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
      <Preview>{t.resetConfirmation.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logo}>{name}</Text>
          </Section>

          <Heading style={h1}>{t.resetConfirmation.heading}</Heading>

          <Text style={text}>
            {t.greeting(firstName)} {t.resetConfirmation.body}
          </Text>

          <Text style={textMuted}>{t.resetConfirmation.ignore}</Text>

          <Hr style={hr} />

          <Text style={footer}>{t.copyright(new Date().getFullYear())}</Text>
        </Container>
      </Body>
    </Html>,
  )
}
