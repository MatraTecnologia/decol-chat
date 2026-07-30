import { createAccessControl } from 'better-auth/plugins/access'

import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access'

const statement = {
  ...defaultStatements,
  member: ['read'],
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
  member: ['read'],
})

export const user = ac.newRole({
  ...userAc.statements,
  member: ['read'],
})
