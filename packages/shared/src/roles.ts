export const ROLES = ['admin', 'user'] as const

export type RoleType = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleType, string> = {
  admin: 'Admin',
  user: 'User',
}

export const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Admin',
    icon: 'ShieldCheck',
    description: 'Full access. Manages members, resources, and settings.',
  },
  {
    value: 'user',
    label: 'User',
    icon: 'User',
    description: 'Read-only access to public features.',
  },
] as const
