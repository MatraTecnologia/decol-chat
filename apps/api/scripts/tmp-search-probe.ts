import 'dotenv/config'

import { prisma } from '@/lib/prisma.js'

const main = async () => {
  const version = await prisma.$queryRawUnsafe(`select version()`)
  console.log('version', version)

  const available = await prisma.$queryRawUnsafe(
    `select name, default_version, installed_version from pg_available_extensions where name in ('pg_trgm','unaccent')`,
  )
  console.log('extensions', available)

  const counts = await prisma.$queryRawUnsafe(
    `select (select count(*) from "message") as messages, (select count(*) from "conversation") as conversations`,
  )
  console.log('counts', counts)

  const cfg = await prisma.$queryRawUnsafe(
    `select cfgname from pg_ts_config where cfgname in ('portuguese','simple')`,
  )
  console.log('ts_configs', cfg)

  await prisma.$disconnect()
}

void main()
