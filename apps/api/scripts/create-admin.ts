import 'dotenv/config'

import { randomBytes } from 'node:crypto'

import { auth } from '../src/lib/auth.js'
import { prisma } from '../src/lib/prisma.js'

// Cria um admin. Com o cadastro público fechado, é o único caminho para o
// primeiro usuário de um banco novo; os demais o admin cria pelo painel.
//
//   pnpm --filter @workspace/api create-admin <email> <nome>
//
// A senha é gerada aqui e mostrada uma única vez (nunca passa pelo histórico
// do shell). Troque no primeiro acesso.

const [rawEmail, ...nameParts] = process.argv.slice(2)
const email = rawEmail?.trim().toLowerCase()
const name = nameParts.join(' ').trim()

if (!email || !name) {
  console.error('Uso: pnpm --filter @workspace/api create-admin <email> <nome>')
  process.exit(1)
}

const existing = await prisma.user.findUnique({
  where: { email },
  select: { id: true },
})

if (existing) {
  console.error(`Já existe usuário com o email ${email}.`)
  process.exit(1)
}

const password = randomBytes(18).toString('base64url')

// Chamada server-side sem headers: o plugin admin libera o createUser sem
// sessão só nesse caso. `emailVerified` evita que o requireEmailVerification
// barre o primeiro login.
await auth.api.createUser({
  body: { email, name, password, role: 'admin', data: { emailVerified: true } },
})

console.log(`Admin criado: ${email}`)
console.log(`Senha (mostrada só agora): ${password}`)
process.exit(0)
