import { queryOptions } from '@tanstack/react-query'

import { getOverview, type Overview } from '@/lib/httpApi'

export const overviewQueryKey = ['overview'] as const

export const overviewQueryOptions = queryOptions({
  queryKey: overviewQueryKey,
  queryFn: getOverview,
})

export function requireLoadedOverview(overview: Overview | null | undefined) {
  if (overview === null || overview === undefined) {
    throw new Error('No se ha podido cargar la porra.')
  }

  return overview
}
