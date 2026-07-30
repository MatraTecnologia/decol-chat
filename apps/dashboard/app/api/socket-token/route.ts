import { cookies } from 'next/headers'

import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
} from '@workspace/shared/auth-cookie'

export async function GET() {
  const cookieStore = await cookies()

  const token =
    cookieStore.get(SECURE_SESSION_COOKIE)?.value ??
    cookieStore.get(SESSION_COOKIE)?.value

  return Response.json({ token: token ?? null })
}
