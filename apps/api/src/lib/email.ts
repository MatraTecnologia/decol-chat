import { Resend } from 'resend'

import { env } from '@/env.js'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })

  if (error) {
    console.error('Failed to send email:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
