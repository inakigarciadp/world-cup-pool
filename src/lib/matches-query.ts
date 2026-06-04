import { queryOptions } from '@tanstack/react-query'

import {
  getGoalscorers,
  getGoalscorersAdmin,
  getMatchAdmin,
  getMatches,
  type GoalscorersAdminPayload,
  type GoalscorersPayload,
  type MatchAdminPayload,
  type MatchesPayload,
} from '@/lib/httpApi'

export const matchesQueryKey = (includePast: boolean) => ['matches', { includePast }] as const
export const goalscorersQueryKey = ['goalscorers'] as const
export const matchAdminQueryKey = (matchId: string) => ['matches', 'admin', { matchId }] as const
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

export function matchAdminQueryOptions(matchId: string) {
  return queryOptions({
    queryKey: matchAdminQueryKey(matchId),
    queryFn: () => getMatchAdmin(matchId),
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

export function requireLoadedMatchAdmin(admin: MatchAdminPayload | null | undefined) {
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
