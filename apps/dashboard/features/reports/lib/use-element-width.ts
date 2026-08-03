'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Largura em pixels do container, para desenhar o SVG em coordenadas reais.
 * Sem isso o `viewBox` escalaria traços e rótulos junto com a caixa.
 */
export const useElementWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    setWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
