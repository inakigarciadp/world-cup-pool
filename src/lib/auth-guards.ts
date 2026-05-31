import { redirect } from '@tanstack/react-router'

import { getSessionOverview, loadSessionOverview } from '@/lib/auth-session'

export async function redirectIfAuthenticated() {
  const currentOverview = getSessionOverview()
  const overview = currentOverview === undefined ? await loadSessionOverview() : currentOverview

  if (overview) {
    throw redirect({ to: '/' })
  }
}

export async function requireOverview() {
  const overview = await loadSessionOverview()

  if (!overview) {
    throw redirect({ to: '/login' })
  }

  return { overview }
}
