import { queryOptions } from '@tanstack/react-query'

import {
  getGoalscorers,
  getGoalscorersAdmin,
  getMatchesAdmin,
  getMatches,
  type GoalscorersAdminPayload,
  type GoalscorersPayload,
  type MatchesAdminPayload,
  type MatchesPayload,
} from '@/lib/httpApi'

export const matchesQueryKey = (includePast: boolean) => ['matches', { includePast }] as const
export const goalscorersQueryKey = ['goalscorers'] as const
export const matchesAdminQueryKey = (matchId: string) => ['matches', 'admin', matchId] as const
export const goalscorersAdminQueryKey = ['goalscorers', 'admin'] as const

export function matchesQueryOptions(includePast: boolean) {
  return queryOptions({
    queryKey: matchesQueryKey(includePast),
    queryFn: () => getMatches(includePast),
  })
}

export const goalscorersQueryOptions = queryOptions({
  queryKey: goalscorersQueryKey,
  queryFn: getGoalscorers,
})

export function matchesAdminQueryOptions(matchId: string) {
  return queryOptions({
    queryKey: matchesAdminQueryKey(matchId),
    queryFn: () => getMatchesAdmin(matchId),
  })
}

export const goalscorersAdminQueryOptions = queryOptions({
  queryKey: goalscorersAdminQueryKey,
  queryFn: getGoalscorersAdmin,
})

export function requireLoadedMatches(matches: MatchesPayload | null | undefined) {
  if (matches === null || matches === undefined) {
    throw new Error('No se han podido cargar los partidos.')
  }

  return matches
}

export function requireLoadedGoalscorers(goalscorers: GoalscorersPayload | null | undefined) {
  if (goalscorers === null || goalscorers === undefined) {
    throw new Error('No se han podido cargar los goleadores.')
  }

  return goalscorers
}

export function requireLoadedMatchesAdmin(admin: MatchesAdminPayload | null | undefined) {
  if (admin === null || admin === undefined) {
    throw new Error('No se han podido cargar las opciones de edición.')
  }

  return admin
}

export function requireLoadedGoalscorersAdmin(admin: GoalscorersAdminPayload | null | undefined) {
  if (admin === null || admin === undefined) {
    throw new Error('No se han podido cargar las opciones de edición.')
  }

  return admin
}
