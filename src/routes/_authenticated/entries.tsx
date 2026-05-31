import { createFileRoute } from '@tanstack/react-router'

import { EntriesPage } from '@/pages/entries'

export const Route = createFileRoute('/_authenticated/entries')({
  component: EntriesPage,
})
