import { queryOptions } from '@tanstack/react-query'

import { getMatches, type MatchesPayload } from '@/lib/httpApi'

export const matchesQueryKey = (includePast: boolean) => ['matches', { includePast }] as const

export function matchesQueryOptions(includePast: boolean) {
  return queryOptions({
    queryKey: matchesQueryKey(includePast),
    queryFn: () => getMatches(includePast),
  })
}

export function requireLoadedMatches(matches: MatchesPayload | null | undefined) {
  if (matches === null || matches === undefined) {
    throw new Error('No se han podido cargar los partidos.')
  }

  return matches
}
