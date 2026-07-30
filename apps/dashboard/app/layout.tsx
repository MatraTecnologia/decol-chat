import '@workspace/ui/globals.css'

import { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'

import { env } from '@/config/env'
import { ThemeProvider } from '@/providers'
import { Toaster } from '@workspace/ui/components/sonner'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial', 'sans-serif'],
  adjustFontFallback: false,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
}

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_BASE_URL),
  title: {
    default: env.NEXT_PUBLIC_APP_NAME,
    template: `%s | ${env.NEXT_PUBLIC_APP_NAME}`,
  },
  description: env.NEXT_PUBLIC_APP_DESCRIPTION,
  keywords: env.NEXT_PUBLIC_APP_KEYWORDS,
  authors: [{ name: env.NEXT_PUBLIC_APP_CREATOR }],
  creator: env.NEXT_PUBLIC_APP_CREATOR,
  publisher: env.NEXT_PUBLIC_COMPANY_NAME,
  applicationName: env.NEXT_PUBLIC_APP_NAME,
  generator: 'Next.js',
  robots: {
    index: env.NEXT_PUBLIC_INDEXABLE,
    follow: env.NEXT_PUBLIC_INDEXABLE,
    nocache: !env.NEXT_PUBLIC_INDEXABLE,
    googleBot: {
      index: env.NEXT_PUBLIC_INDEXABLE,
      follow: env.NEXT_PUBLIC_INDEXABLE,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: env.NEXT_PUBLIC_BASE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: env.NEXT_PUBLIC_BASE_URL,
    siteName: env.NEXT_PUBLIC_APP_NAME,
    title: env.NEXT_PUBLIC_APP_NAME,
    description: env.NEXT_PUBLIC_APP_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: env.NEXT_PUBLIC_APP_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: env.NEXT_PUBLIC_APP_NAME,
    description: env.NEXT_PUBLIC_APP_DESCRIPTION,
    images: ['/twitter-image'],
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    title: env.NEXT_PUBLIC_APP_NAME,
    statusBarStyle: 'default',
    startupImage: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  category: 'saas',
  verification: {
    google: env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    other: {
      'msvalidate.01': env.NEXT_PUBLIC_BING_VERIFICATION ?? '',
    },
  },
}

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} w-full antialiased`}>
        <ThemeProvider>
          <NextTopLoader showSpinner={false} />
          <Toaster position="top-right" closeButton />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
