'use client'

import { motion } from 'motion/react'
import { LayoutDashboard, Shield, Users } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { env } from '@/config/env'

const features = [
  {
    title: 'Autenticação',
    description:
      'Autenticação por email/senha com 2FA, gerenciamento de sessões e controle de acesso baseado em papéis com Better Auth.',
    icon: Shield,
  },
  {
    title: 'Gestão de usuários',
    description:
      'Painel administrativo para gerenciar usuários, papéis e permissões sem configuração adicional.',
    icon: Users,
  },
  {
    title: 'Atualizações em tempo real',
    description:
      'Integração com Socket.io e invalidação automática do cache do React Query em alterações de dados.',
    icon: LayoutDashboard,
  },
]

export const Client = () => {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">
          Bem-vindo ao {env.NEXT_PUBLIC_APP_NAME}
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          Sua aplicação SaaS está pronta. Comece a construir seu produto
          adicionando funcionalidades ao dashboard.
        </p>
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
          >
            <Card className="h-full shadow-none">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <feature.icon className="text-muted-foreground size-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Getting Started */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Começando</CardTitle>
            <CardDescription>
              Este template inclui tudo que você precisa para construir uma
              aplicação SaaS em produção.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                - <strong>Turborepo</strong> monorepo com pacotes compartilhados
              </li>
              <li>
                - <strong>Next.js 16</strong> dashboard com App Router
              </li>
              <li>
                - <strong>Fastify</strong> API REST com Prisma ORM
              </li>
              <li>
                - <strong>Better Auth</strong> autenticação com suporte a 2FA
              </li>
              <li>
                - <strong>Socket.io</strong> atualizações em tempo real
              </li>
              <li>
                - <strong>BullMQ</strong> jobs em segundo plano (opcional)
              </li>
              <li>
                - <strong>shadcn/ui</strong> biblioteca de componentes
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
