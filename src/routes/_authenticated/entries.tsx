import { createFileRoute } from '@tanstack/react-router'

import { EntriesPage } from '@/pages/entries'

export const Route = createFileRoute('/_authenticated/entries')({
  validateSearch: (search): { participantId?: string } => ({
    participantId: typeof search.participantId === 'string' ? search.participantId : undefined,
  }),
  component: EntriesPage,
})
