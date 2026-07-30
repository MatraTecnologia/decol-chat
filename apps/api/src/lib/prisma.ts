import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'

import { env } from '@/env.js'
import { PrismaClient } from '@/generated/prisma/client.js'

const connectionString = env.DATABASE_URL

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }
