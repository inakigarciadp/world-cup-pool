import { queryOptions } from '@tanstack/react-query'

import { getLeaderboard, type LeaderboardPayload } from '@/lib/httpApi'

export const leaderboardQueryKey = ['leaderboard'] as const

export const leaderboardQueryOptions = queryOptions({
  queryKey: leaderboardQueryKey,
  queryFn: getLeaderboard,
})

export function requireLoadedLeaderboard(leaderboard: LeaderboardPayload | null | undefined) {
  if (leaderboard === null || leaderboard === undefined) {
    throw new Error('No se ha podido cargar la clasificación.')
  }

  return leaderboard
}
