/**
 * Nono dígito brasileiro.
 *
 * A Meta devolve `wa_id` sem o 9 para boa parte dos celulares brasileiros
 * (`554399140409`), enquanto o número real que se digita tem o 9
 * (`5543999140409`). Sem uma chave canônica, o mesmo cliente vira dois
 * contatos: um criado no envio, outro criado pelo webhook.
 *
 * Estrutura de um número BR em E.164:
 *   celular  55 + DDD(2) + 9 + 8 dígitos = 13
 *   fixo     55 + DDD(2) + 8 dígitos     = 12   (nunca teve o 9)
 *
 * `phoneKey` é só para deduplicação. O `waId` continua sendo o valor da Meta —
 * é ele que casa o webhook e para quem se responde.
 */

const BR = '55'
const MOBILE_LENGTH = 13
const LANDLINE_LENGTH = 12

/** Assinante de celular BR (bloco de 8) sempre começou em 6–9; fixo, em 2–5. */
const MOBILE_FIRST_DIGITS = '6789'

export const onlyDigits = (value: string) => value.replace(/\D/g, '')

const isBrazilian = (digits: string) => digits.startsWith(BR)

/**
 * Forma canônica para dedupe: celular brasileiro perde o nono dígito, todo o
 * resto passa intacto. Número fora do Brasil nunca é tocado — a regra do 9 é
 * exclusivamente brasileira e mexer em outro país corromperia o número.
 */
export const phoneKey = (value: string) => {
  const digits = onlyDigits(value)

  if (!isBrazilian(digits) || digits.length !== MOBILE_LENGTH) return digits

  const ddd = digits.slice(2, 4)
  const subscriber = digits.slice(4)

  // 13 dígitos sem 9 na posição do nono não é celular BR conhecido — não mexer.
  if (!subscriber.startsWith('9')) return digits

  // Celular de 8 dígitos sempre começou em 6–9; fixo começa em 2–5. Sem esta
  // checagem, o celular 9 3222-1111 viraria 3222-1111 e colidiria com o fixo
  // de mesmo DDD — dois assinantes diferentes na mesma chave de dedupe.
  if (!MOBILE_FIRST_DIGITS.includes(subscriber[1] ?? '')) return digits

  return `${BR}${ddd}${subscriber.slice(1)}`
}

/**
 * Forma para enviar à Graph API: celular brasileiro recebe o nono dígito de
 * volta. A Meta aceita as duas formas no `to`, mas a completa é a que a
 * documentação recomenda e a que sobrevive a mudanças de operadora.
 *
 * O primeiro dígito distingue fixo de celular: 2–5 é fixo (fica como está),
 * 6–9 é celular (ganha o 9). Sem essa checagem, um fixo viraria um número
 * inexistente de 13 dígitos.
 */
export const toSendFormat = (value: string) => {
  const digits = onlyDigits(value)

  if (!isBrazilian(digits) || digits.length !== LANDLINE_LENGTH) return digits

  const ddd = digits.slice(2, 4)
  const subscriber = digits.slice(4)
  const first = subscriber[0] ?? ''

  if (!MOBILE_FIRST_DIGITS.includes(first)) return digits

  return `${BR}${ddd}9${subscriber}`
}

/** Máscara de exibição — só para BR, o resto sai como veio. */
export const formatPhone = (value: string) => {
  const digits = onlyDigits(value)

  if (!isBrazilian(digits)) return `+${digits}`

  const ddd = digits.slice(2, 4)
  const subscriber = digits.slice(4)

  if (subscriber.length === 9) {
    return `+55 (${ddd}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
  }

  if (subscriber.length === 8) {
    return `+55 (${ddd}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`
  }

  return `+${digits}`
}

/**
 * Validação mínima para o formulário de nova conversa: E.164 tem no máximo 15
 * dígitos, e um número utilizável tem pelo menos 10 (país + área + assinante).
 */
export const isValidPhone = (value: string) => {
  const digits = onlyDigits(value)

  if (digits.length < 10 || digits.length > 15) return false
  if (!isBrazilian(digits)) return true

  return digits.length === LANDLINE_LENGTH || digits.length === MOBILE_LENGTH
}
