export const ROLES = ['admin', 'manager', 'agent', 'viewer', 'user'] as const

export type RoleType = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleType, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  agent: 'Vendedor',
  viewer: 'Somente leitura',
  user: 'Usuário',
}

export const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Administrador',
    icon: 'ShieldCheck',
    description:
      'Acesso total. Gerencia usuários, regras, contas e configurações.',
  },
  {
    value: 'manager',
    label: 'Gestor',
    icon: 'Users',
    description:
      'Vê todas as conversas, reatribui atendimentos e acompanha a equipe.',
  },
  {
    value: 'agent',
    label: 'Vendedor',
    icon: 'Briefcase',
    description: 'Atende e responde apenas as conversas atribuídas a ele.',
  },
  {
    value: 'viewer',
    label: 'Somente leitura',
    icon: 'Eye',
    description:
      'Visualiza apenas as conversas atribuídas a ele, sem enviar mensagens.',
  },
  {
    value: 'user',
    label: 'Usuário',
    icon: 'User',
    description: 'Acesso somente leitura aos recursos públicos.',
  },
] as const
