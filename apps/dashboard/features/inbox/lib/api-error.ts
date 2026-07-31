/**
 * Com `throwOnError` o hey-api lança o corpo do Fastify (`{ statusCode,
 * message }`), que já vem em pt-BR. Um `TypeError` de rede não tem
 * `statusCode` e traria "Failed to fetch" para a tela — daí o fallback.
 */
export const errorText = (error: unknown, fallback: string) => {
  const body = error as { statusCode?: unknown; message?: unknown } | null

  if (typeof body?.statusCode === 'number' && typeof body.message === 'string')
    return body.message || fallback

  return fallback
}
