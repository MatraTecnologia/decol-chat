import { getConstants, init } from '@paralleldrive/cuid2'

export const generateId = (length?: number) => {
  const constants = getConstants()

  const id = init({
    length: length ?? constants.defaultLength,
  })

  return id()
}
