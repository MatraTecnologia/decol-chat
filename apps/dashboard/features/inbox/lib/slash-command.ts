const TEMPLATE_COMMAND = '/template:'

export interface SlashCommand {
  active: boolean
  query: string
}

const INACTIVE: SlashCommand = { active: false, query: '' }

/**
 * O menu só abre quando o rascunho inteiro começa com `/template:`; qualquer
 * espaço ou quebra de linha depois do comando encerra a busca.
 */
export const parseSlashCommand = (text: string): SlashCommand => {
  if (!text.startsWith(TEMPLATE_COMMAND)) return INACTIVE

  const query = text.slice(TEMPLATE_COMMAND.length)
  if (/\s/.test(query)) return INACTIVE

  return { active: true, query }
}
