import { ImageResponse } from 'next/og'

import { env } from '@/config/env'

// Runtime
export const runtime = 'edge'

// Image metadata
export const alt = env.NEXT_PUBLIC_APP_NAME
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Image generation - same as opengraph-image
export default async function Image() {
  const appName = env.NEXT_PUBLIC_APP_NAME
  const appDescription = env.NEXT_PUBLIC_APP_DESCRIPTION

  return new ImageResponse(
    (
      <div
        style={{
          background:
            'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #8b5cf6 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            background:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {/* Rocket Icon */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <svg
              width="70"
              height="70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>

          {/* App Name */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 20,
              textAlign: 'center',
              textShadow: '0 4px 12px rgba(0,0,0,0.4)',
              letterSpacing: '-0.02em',
            }}
          >
            {appName}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 36,
              color: 'rgba(255,255,255,0.95)',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.3,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {appDescription}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
