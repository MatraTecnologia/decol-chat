import Link from 'next/link'

import { Button } from '@workspace/ui/components/button'

import { env } from '@/config/env'

const Page = () => {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {env.NEXT_PUBLIC_APP_NAME}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Um template full-stack para SaaS construído com Turborepo, Next.js,
          Fastify, Prisma e Better Auth.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/sign-in">Entrar</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-up">Criar conta</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Page
