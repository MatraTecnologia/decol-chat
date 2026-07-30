import type { MetadataRoute } from 'next'

import { env } from '@/config/env'

const buildBaseUrl = () => {
  const rawUrl = env.NEXT_PUBLIC_BASE_URL
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = buildBaseUrl()
  const now = new Date()

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]
}
