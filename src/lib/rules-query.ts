import { queryOptions } from '@tanstack/react-query'

import { getRulesData, type RulesPayload } from '@/lib/httpApi'

export const rulesQueryKey = ['rules'] as const

export const rulesQueryOptions = queryOptions({
  queryKey: rulesQueryKey,
  queryFn: getRulesData,
})

export function requireLoadedRules(rules: RulesPayload | null | undefined) {
  if (rules === null || rules === undefined) {
    throw new Error('No se han podido cargar las reglas.')
  }

  return rules
}
