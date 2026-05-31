import { createFileRoute } from '@tanstack/react-router'

import { LeaderboardPage } from '@/pages/leaderboard'

export const Route = createFileRoute('/_authenticated/')({
  component: LeaderboardPage,
})
