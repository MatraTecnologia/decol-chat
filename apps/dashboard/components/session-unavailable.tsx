import { AlertTriangle } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'

/**
 * Estado de indisponibilidade de sessão. Renderizado quando o `get-session`
 * FALHA (timeout, 500, Redis fora) — NÃO deve redirecionar nem limpar cookies:
 * um blip transitório não é um logout. Ver docs/better-auth-production-playbook.md §3.
 */
export const SessionUnavailable = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <AlertTriangle className="text-muted-foreground size-10" />
    <div className="space-y-1">
      <h1 className="text-lg font-semibold">
        Não foi possível validar sua sessão
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Houve uma falha temporária ao verificar seu login. Sua sessão não foi
        encerrada — tente novamente em instantes.
      </p>
    </div>
    <Button asChild>
      <a href="/dashboard">Tentar novamente</a>
    </Button>
  </div>
)
