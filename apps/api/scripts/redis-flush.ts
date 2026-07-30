import 'dotenv/config'

import { Redis } from 'ioredis'

const url = process.env.REDIS_URL
if (!url) {
  console.error('REDIS_URL not set — skipping flush')
  process.exit(0)
}

const redis = new Redis(url)
await redis.flushall()
console.log('Redis flushed')
await redis.quit()
