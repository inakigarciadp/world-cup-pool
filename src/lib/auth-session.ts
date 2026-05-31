import { queryClient } from '@/lib/query-client'
import { getOverview, login, logout } from '@/lib/httpApi'
import { overviewQueryKey, overviewQueryOptions } from '@/lib/overview-query'

export function getSessionOverview() {
  return queryClient.getQueryData(overviewQueryKey)
}

export async function loadSessionOverview() {
  try {
    return await queryClient.fetchQuery(overviewQueryOptions)
  } catch {
    queryClient.setQueryData(overviewQueryKey, null)
    return null
  }
}

export async function loginSession(loginName: string, pin: string) {
  await login(loginName, pin)
  const overview = await getOverview()

  if (overview === null) {
    throw new Error('No se ha podido iniciar la sesión.')
  }

  queryClient.setQueryData(overviewQueryKey, overview)
  return overview
}

export async function logoutSession() {
  await logout()
  queryClient.setQueryData(overviewQueryKey, null)
}
