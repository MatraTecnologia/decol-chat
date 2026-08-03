const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Nomes na ordem da primeira ocorrência, sem repetir — a mesma contagem que o
 * schema compartilhado usa para exigir um exemplo por variável.
 */
export const extractVariables = (text: string) => {
  const names: string[] = []

  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]
    if (name && !names.includes(name)) names.push(name)
  }

  return names
}
