/**
 * Resultado uniforme do domínio de templates.
 *
 * O serviço não lança para erro esperado: a rota precisa distinguir 404, 409,
 * 422 e 502 sem inspecionar mensagem de exceção.
 */
export type TemplateFailure =
  | { status: 'not_found' }
  | { status: 'conflict'; message: string }
  | { status: 'duplicate'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'remote_error'; message: string; httpStatus: number }

export type TemplateResult<T> = { status: 'ok'; data: T } | TemplateFailure

export const ok = <T>(data: T) => ({ status: 'ok' as const, data })

export const notFound = () => ({ status: 'not_found' as const })

export const conflict = (message: string) => ({
  status: 'conflict' as const,
  message,
})

export const duplicate = (message: string) => ({
  status: 'duplicate' as const,
  message,
})

export const invalid = (message: string) => ({
  status: 'invalid' as const,
  message,
})

export const remoteError = (message: string, httpStatus: number) => ({
  status: 'remote_error' as const,
  message,
  httpStatus,
})
