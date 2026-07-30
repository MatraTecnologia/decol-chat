import type { MetadataRoute } from 'next'

import { env } from '@/config/env'

const buildBaseUrl = () => {
  const rawUrl = env.NEXT_PUBLIC_BASE_URL
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

export default function manifest(): MetadataRoute.Manifest {
  const appName = env.NEXT_PUBLIC_APP_NAME
  const appDescription = env.NEXT_PUBLIC_APP_DESCRIPTION
  const baseUrl = buildBaseUrl()

  return {
    name: appName,
    short_name: appName,
    description: appDescription,
    id: baseUrl,
    scope: '/',
    start_url: '/?utm_source=pwa',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#ffffff',
    lang: 'pt-BR',
    categories: ['productivity', 'utilities', 'business'],
    dir: 'ltr',
    theme_color: '#3b82f6',
    orientation: 'portrait',
    shortcuts: [
      {
        name: 'Página Inicial',
        short_name: 'Home',
        description: 'Ir para a página inicial',
        url: '/',
        icons: [
          {
            src: '/favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
        ],
      },
    ],
    prefer_related_applications: false,
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  }
}
