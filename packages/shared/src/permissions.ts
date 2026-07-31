import { createAccessControl } from 'better-auth/plugins/access'

import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access'

const statement = {
  ...defaultStatements,
  member: ['read'],
  conversation: ['read', 'read:own', 'write', 'assign', 'close', 'delete'],
  message: ['read', 'read:own', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read', 'write'],
  whatsappAccount: ['read', 'write'],
  report: ['read', 'read:team'],
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
  member: ['read'],
  conversation: ['read', 'write', 'assign', 'close', 'delete'],
  message: ['read', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read', 'write'],
  whatsappAccount: ['read', 'write'],
  report: ['read'],
})

export const manager = ac.newRole({
  member: ['read'],
  conversation: ['read', 'write', 'assign', 'close'],
  message: ['read', 'send'],
  contact: ['read', 'write'],
  distributionRule: ['read'],
  whatsappAccount: ['read'],
  report: ['read', 'read:team'],
})

export const agent = ac.newRole({
  conversation: ['read:own', 'write', 'close'],
  message: ['read:own', 'send'],
  contact: ['read'],
})

export const viewer = ac.newRole({
  conversation: ['read:own'],
  message: ['read:own'],
})

export const user = ac.newRole({
  ...userAc.statements,
  member: ['read'],
})
