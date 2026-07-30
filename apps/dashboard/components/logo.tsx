'use client'

import Image from 'next/image'
import Link from 'next/link'

import { env } from '@/config/env'

interface LogoProps {
  href?: string
  className?: string
}

export function Logo({ href = '/', className }: LogoProps) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2 font-bold tracking-tight ${className ?? ''}`}
    >
      <Image
        priority
        width={24}
        height={24}
        draggable={false}
        src="/logo-mark.png"
        alt={env.NEXT_PUBLIC_APP_NAME}
        className="size-6"
      />
    </Link>
  )
}
