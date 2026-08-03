import type { QueryClient } from '@tanstack/react-query'

import { matchesQueryTags } from './query-tags'

export const invalidateByTags = (queryClient: QueryClient, tags: string[]) => {
  queryClient.invalidateQueries({
    predicate: query => matchesQueryTags(query.queryKey, tags),
  })
}
