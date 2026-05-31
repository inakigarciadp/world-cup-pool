import { getOverview, login, logout, type Overview } from '@/lib/httpApi'

let currentOverview: Overview | null | undefined
let overviewRequest: Promise<Overview | null> | null = null

export async function loadSessionOverview() {
  if (currentOverview !== undefined) {
    return currentOverview
  }

  overviewRequest ??= getOverview()

  try {
    currentOverview = await overviewRequest
    return currentOverview
  } catch {
    currentOverview = null
    return null
  } finally {
    overviewRequest = null
  }
}

export function getSessionOverview() {
  return currentOverview
}

export function setSessionOverview(overview: Overview) {
  currentOverview = overview
}

export async function loginSession(loginName: string, pin: string) {
  await login(loginName, pin)
  const overview = await getOverview()

  if (overview === null) {
    throw new Error('No se ha podido iniciar la sesión.')
  }

  setSessionOverview(overview)
  return overview
}

export async function logoutSession() {
  await logout()
  currentOverview = null
  overviewRequest = null
}
