import { createFileRoute } from '@tanstack/react-router'

import { MatchesPage } from '@/pages/matches'

export const Route = createFileRoute('/_authenticated/matches')({
  component: MatchesPage,
})
