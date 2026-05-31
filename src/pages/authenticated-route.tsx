import { getRouteApi } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/pages/authenticated-layout'

const authenticatedRoute = getRouteApi('/_authenticated')

export function AuthenticatedRoute() {
  const { overview } = authenticatedRoute.useRouteContext()

  return <AuthenticatedLayout initialOverview={overview} />
}
