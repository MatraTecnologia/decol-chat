'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'

import { connectWhatsappEmbeddedSignup } from '@workspace/api-client/sdk'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { env } from '@/config/env'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js'
const GRAPH_VERSION = 'v25.0'
// Comparação exata (não endsWith/includes): evita que origens como
// "https://evil-facebook.com" passem no filtro.
const ALLOWED_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com',
])

interface SignupData {
  phone_number_id?: string
  waba_id?: string
}

type SdkState = 'loading' | 'ready' | 'error'

export const EmbeddedSignupButton = () => {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  // Lazy: numa remontagem com o SDK já carregado o `fbAsyncInit` não dispara
  // de novo, e o botão ficaria preso em "Carregando...".
  const [sdkState, setSdkState] = useState<SdkState>(() =>
    typeof window !== 'undefined' && window.FB ? 'ready' : 'loading',
  )
  const signupData = useRef<SignupData | null>(null)

  const appId = env.NEXT_PUBLIC_META_APP_ID
  const configId = env.NEXT_PUBLIC_META_ES_CONFIG_ID

  useEffect(() => {
    if (!appId) return

    // O SDK precisa da callback global definida antes do script carregar.
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION })
      setSdkState('ready')
    }

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = SDK_SRC
      script.async = true
      // Bloqueador de rastreadores derruba connect.facebook.net. Sem tratar o
      // erro, o SDK some em silêncio e o clique não faz nada.
      script.onerror = () => setSdkState('error')
      document.body.appendChild(script)
    }

    // O phone_number_id e o waba_id só chegam por postMessage; o callback do
    // FB.login devolve apenas o code.
    const onMessage = (event: MessageEvent) => {
      if (!ALLOWED_ORIGINS.has(event.origin)) return

      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type !== 'WA_EMBEDDED_SIGNUP') return

        if (parsed.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          signupData.current = parsed.data
        }
      } catch {
        // Mensagem que não é JSON não é do fluxo de signup.
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appId])

  const onConnect = () => {
    if (!configId) return

    // Chamada direta, sem `?.`: com optional chaining um SDK ausente vira
    // no-op silencioso e o botão fica preso em "Conectando...".
    if (!window.FB) {
      setSdkState('error')
      toast.error(
        'O SDK do Facebook não carregou. Desative o bloqueador de rastreadores para este site e recarregue a página.',
      )
      return
    }

    setIsPending(true)

    window.FB.login(
      async response => {
        const code = response?.authResponse?.code
        const data = signupData.current

        if (!code || !data?.phone_number_id || !data?.waba_id) {
          setIsPending(false)
          toast.error('Conexão cancelada antes de concluir o cadastro.')
          return
        }

        const result = await connectWhatsappEmbeddedSignup({
          body: {
            code,
            phoneNumberId: data.phone_number_id,
            wabaId: data.waba_id,
          },
        })

        setIsPending(false)

        if (result.error) {
          toast.error('Não foi possível concluir a conexão.')
          return
        }

        toast.success('Número conectado — ele continua ativo no celular.')
        invalidateByTags(queryClient, ['WhatsApp'])
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar número</CardTitle>
        <CardDescription>
          O número continua funcionando no app WhatsApp Business do celular. Nada
          de token colado à mão — a Meta devolve as credenciais no fim do fluxo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appId && configId ? (
          <div className="space-y-2">
            <Button
              onClick={onConnect}
              disabled={isPending || sdkState !== 'ready'}
            >
              <MessageCircle className="size-4" />
              {isPending
                ? 'Conectando...'
                : sdkState === 'loading'
                  ? 'Carregando SDK...'
                  : 'Conectar com o WhatsApp'}
            </Button>

            {sdkState === 'error' && (
              <p className="text-destructive text-sm">
                O SDK do Facebook foi bloqueado. Desative o bloqueador de
                rastreadores para este site e recarregue a página.
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Defina NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_ES_CONFIG_ID para
            habilitar a conexão.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
