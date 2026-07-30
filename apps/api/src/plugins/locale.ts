import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { getLocale, t } from '@/lib/locale.js'

const localePlugin: FastifyPluginAsync = async app => {
  app.decorateRequest('locale', '')

  app.decorateRequest<(key: string, fallback?: string) => string>('t', {
    getter(this: FastifyRequest) {
      return (key: string, fallback?: string) => t(this.locale, key, fallback)
    },
  })

  app.addHook('onRequest', async request => {
    request.locale = getLocale(request)
  })
}

export const localePluginExport = fp(localePlugin)
