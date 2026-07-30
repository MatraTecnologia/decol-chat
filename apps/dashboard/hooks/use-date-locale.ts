import type { Locale } from 'date-fns'
import { useEffect, useState } from 'react'

type LocaleModule = Record<string, Locale>

const localeMap: Record<string, () => Promise<LocaleModule>> = {
  'pt-BR': () => import('date-fns/locale/pt-BR'),
  pt: () => import('date-fns/locale/pt'),
  'en-US': () => import('date-fns/locale/en-US'),
  en: () => import('date-fns/locale/en-US'),
  es: () => import('date-fns/locale/es'),
  'es-ES': () => import('date-fns/locale/es'),
  fr: () => import('date-fns/locale/fr'),
  'fr-FR': () => import('date-fns/locale/fr'),
  de: () => import('date-fns/locale/de'),
  'de-DE': () => import('date-fns/locale/de'),
  it: () => import('date-fns/locale/it'),
  'it-IT': () => import('date-fns/locale/it'),
  ja: () => import('date-fns/locale/ja'),
  'ja-JP': () => import('date-fns/locale/ja'),
  ko: () => import('date-fns/locale/ko'),
  'ko-KR': () => import('date-fns/locale/ko'),
  'zh-CN': () => import('date-fns/locale/zh-CN'),
  'zh-TW': () => import('date-fns/locale/zh-TW'),
  zh: () => import('date-fns/locale/zh-CN'),
}

function getLocaleKey(userLocale: string): string {
  if (localeMap[userLocale]) {
    return userLocale
  }

  const language = userLocale.split('-')[0]
  if (language && localeMap[language]) {
    return language
  }

  return 'en-US'
}

function extractLocale(module: LocaleModule): Locale | undefined {
  const keys = Object.keys(module)
  const localeKey = keys.find(key => key !== '__esModule')
  return localeKey ? module[localeKey] : undefined
}

export function useDateLocale() {
  const [locale, setLocale] = useState<Locale | undefined>(undefined)

  useEffect(() => {
    const userLocale = navigator.language || 'en-US'
    const localeKey = getLocaleKey(userLocale)
    const loader = localeMap[localeKey]

    if (loader) {
      loader()
        .then(module => setLocale(extractLocale(module)))
        .catch(() => {
          import('date-fns/locale/en-US').then(module =>
            setLocale(extractLocale(module)),
          )
        })
    }
  }, [])

  return locale
}
