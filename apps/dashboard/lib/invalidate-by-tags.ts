import type { QueryClient } from '@tanstack/react-query'

export const invalidateByTags = (queryClient: QueryClient, tags: string[]) => {
  queryClient.invalidateQueries({
    predicate: query => {
      const key = query.queryKey[0]
      if (typeof key === 'object' && key !== null && 'tags' in key) {
        const queryTags = (key as { tags?: readonly string[] }).tags
        if (!queryTags) return false
        return queryTags.some(tag => tags.includes(tag))
      }
      return false
    },
  })
}
