import type { MetadataRoute } from 'next'

import { env } from '@/config/env'

const buildBaseUrl = () => {
  const rawUrl = env.NEXT_PUBLIC_BASE_URL
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = buildBaseUrl()
  const isIndexable = env.NEXT_PUBLIC_INDEXABLE

  // Block all crawlers when indexing is disabled
  if (!isIndexable) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: ['/'],
        },
      ],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/dashboard/', '/api/', '/admin/', '/_next/', '/private/'],
        crawlDelay: 5,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
