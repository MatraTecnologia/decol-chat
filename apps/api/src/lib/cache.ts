import { redis } from './redis.js'

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      return null
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        await redis.set(key, serialized, 'EX', ttlSeconds)
      } else {
        await redis.set(key, serialized)
      }
    } catch {
      // Graceful fallback — cache write failure is non-critical
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch {
      // Graceful fallback
    }
  },

  async invalidate(pattern: string): Promise<void> {
    try {
      let cursor = '0'
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        )
        cursor = nextCursor
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } while (cursor !== '0')
    } catch {
      // Graceful fallback
    }
  },
}
