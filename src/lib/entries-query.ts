import { queryOptions } from '@tanstack/react-query'

import { getEntriesData, type EntriesPayload } from '@/lib/httpApi'

export const entriesQueryKey = ['entries'] as const

export const entriesQueryOptions = queryOptions({
  queryKey: entriesQueryKey,
  queryFn: getEntriesData,
})

export function requireLoadedEntries(entries: EntriesPayload | null | undefined) {
  if (entries === null || entries === undefined) {
    throw new Error('No se han podido cargar las entradas.')
  }

  return entries
}
