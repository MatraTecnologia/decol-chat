/**
 * Matriz de acesso das rotas de modelo.
 *
 * Pura de propósito: o `node --test` carrega este módulo direto, então nada
 * aqui pode importar o alias `@/` nem um relativo com extensão `.js` — o runner
 * não reescreve o `.js` para `.ts`. Só `@workspace/shared`, que resolve pelo
 * `dist` do pacote.
 */
import { ROLES, type RoleType } from '@workspace/shared/roles'

import {
  canManageTemplates,
  canReadTemplates,
} from '@workspace/shared/whatsapp-templates'

export interface TemplateRouteCapabilities {
  read: boolean
  manage: boolean
}

export const getTemplateRouteCapabilities = (
  role: string,
): TemplateRouteCapabilities => ({
  read: canReadTemplates(role as RoleType),
  manage: canManageTemplates(role as RoleType),
})

/** Os papéis aceitos vêm da própria matriz: uma regra só, sem lista paralela. */
const rolesWith = (capability: keyof TemplateRouteCapabilities): RoleType[] =>
  ROLES.filter(role => getTemplateRouteCapabilities(role)[capability])

export const TEMPLATE_READ_ROLES = rolesWith('read')
export const TEMPLATE_MANAGE_ROLES = rolesWith('manage')
