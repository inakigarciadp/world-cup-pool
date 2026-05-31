import { createFileRoute } from '@tanstack/react-router'

import { requireOverview } from '@/lib/auth-guards'
import { AuthenticatedRoute } from '@/pages/authenticated-route'
import { LoadingScreen } from '@/pages/loading-screen'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: requireOverview,
  component: AuthenticatedRoute,
  pendingComponent: LoadingScreen,
})
