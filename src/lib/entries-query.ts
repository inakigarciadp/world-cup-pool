import { queryOptions } from '@tanstack/react-query'

import { getEntriesData, type EntriesPayload } from '@/lib/httpApi'

export const entriesRootQueryKey = ['entries'] as const

export function entriesQueryKey(includeEligiblePlayers: boolean) {
  return [...entriesRootQueryKey, { includeEligiblePlayers }] as const
}

export function entriesQueryOptions(includeEligiblePlayers: boolean) {
  return queryOptions({
    queryKey: entriesQueryKey(includeEligiblePlayers),
    queryFn: () => getEntriesData(includeEligiblePlayers),
  })
}

export function requireLoadedEntries(entries: EntriesPayload | null | undefined) {
  if (entries === null || entries === undefined) {
    throw new Error('No se han podido cargar las entradas.')
  }

  return entries
}
