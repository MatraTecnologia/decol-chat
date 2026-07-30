import { createHash } from 'crypto'

/**
 * Gera a URL do Gravatar.
 * Se o usuário não tiver conta, o Gravatar retorna uma imagem padrão (fallback).
 */
export function getUserAvatar(email: string, size: number = 200): string {
  // 1. Tratamento: remover espaços e passar para minúsculas
  const address = email.trim().toLowerCase()

  // 2. Criar o hash MD5
  const hash = createHash('md5').update(address).digest('hex')

  /**
   * Opções de fallback (parâmetro d):
   * - mp: (Mystery Person) Silhueta genérica
   * - identicon: Padrão geométrico (ótimo para devs)
   * - monsterid: Monstros gerados aleatoriamente
   * - 404: Retorna erro se não existir (útil para detectar via código)
   */
  const fallback = 'identicon'

  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`
}
