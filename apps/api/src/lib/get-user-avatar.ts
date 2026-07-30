import { createHash } from 'node:crypto'

export function getUserAvatar(email: string, size: number = 200): string {
  const address = email.trim().toLowerCase()
  const hash = createHash('md5').update(address).digest('hex')
  const fallback = 'identicon'

  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`
}
