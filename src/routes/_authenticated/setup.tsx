import { createFileRoute } from '@tanstack/react-router'

import { SetupPage } from '@/pages/setup'

export const Route = createFileRoute('/_authenticated/setup')({
  component: SetupPage,
})
