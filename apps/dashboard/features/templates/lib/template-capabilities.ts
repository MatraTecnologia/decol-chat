import {
  canManageTemplates,
  canReadTemplates,
} from '@workspace/shared/whatsapp-templates'

import type { RoleType } from '@workspace/shared/roles'

/** Espelha `SENDERS` em `apps/api/src/routes/conversations/guards.ts`. */
const TEMPLATE_SENDERS: RoleType[] = ['admin', 'manager', 'agent']

export interface TemplateCapabilities {
  canRead: boolean
  canManage: boolean
  canSend: boolean
}

const NO_CAPABILITIES: TemplateCapabilities = {
  canRead: false,
  canManage: false,
  canSend: false,
}

export const getTemplateCapabilities = (
  role: string | null,
): TemplateCapabilities => {
  if (role === null) return NO_CAPABILITIES

  const typedRole = role as RoleType

  return {
    canRead: canReadTemplates(typedRole),
    canManage: canManageTemplates(typedRole),
    canSend:
      canReadTemplates(typedRole) && TEMPLATE_SENDERS.includes(typedRole),
  }
}
