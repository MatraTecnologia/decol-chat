import type { NextConfig } from 'next'

// Build-time env validation
import './config/env'

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  transpilePackages: [
    '@workspace/ui',
    '@workspace/api-client',
    '@t3-oss/env-nextjs',
    '@t3-oss/env-core',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
