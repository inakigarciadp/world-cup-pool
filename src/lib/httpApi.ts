const API_URL = import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL
let refreshPromise: Promise<boolean> | null = null

export type Overview = {
  session: {
    participantName: string
    isAdmin: boolean
  }
  pool: {
    name: string
    slug: string
    entryLockAt: number
    status: 'setup' | 'open' | 'locked' | 'scoring'
  }
  counts: {
    participants: number
    teamTiers: number
    teams: number
    eligiblePlayers: number
    entries: number
  }
  teamTiers: Array<{
    id: string
    name: string
    requiredPicks: number
    multiplier: number | null
    teams: Array<{
      id: string
      name: string
      fifaCode: string
      groupCode: string
    }>
  }>
  eligiblePlayers: Array<{
    id: string
    teamId: string | null
    tierId: string | null
    name: string
    teamName: string
    teamFifaCode: string
    groupCode: string
  }>
  stageBonuses: Array<{
    id: string
    stage: string
    points: number
  }>
  leaderboard: Array<{
    entryId: string
    participantName: string
    goalscorerPicks: Array<{
      tierName: string
      playerName: string
      teamName: string
    }>
    teamPicks: Array<{
      tierName: string
      teamName: string
    }>
    currentScore: number
    submittedAt: number | null
  }>
  currentEntry: {
    teamPickIds: string[]
    goalscorerPickIds: Array<{
      tierId: string
      eligiblePlayerId: string
    }>
  } | null
}

export async function login(loginName: string, pin: string) {
  return await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginName, pin }),
  })
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' })
}

export async function getOverview() {
  const response = await fetchWithRefreshRetry('/api/overview')

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as Overview
}

export async function saveEntry(
  teamPickIds: string[],
  goalscorerPickIds: Array<{ tierId: string; eligiblePlayerId: string }>,
) {
  return await parseJsonResponse(
    await fetchWithRefreshRetry('/api/entry', {
      method: 'POST',
      body: JSON.stringify({ teamPickIds, goalscorerPickIds }),
    }),
  )
}

async function request(path: string, init: RequestInit) {
  return await parseJsonResponse(await fetchApi(path, init))
}

async function fetchApi(path: string, init: RequestInit = {}) {
  return await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

async function fetchWithRefreshRetry(path: string, init: RequestInit = {}) {
  const response = await fetchApi(path, init)

  if (response.status !== 401) {
    return response
  }

  if (!(await refreshSession())) {
    return response
  }

  return await fetchApi(path, init)
}

async function refreshSession() {
  refreshPromise ??= fetchApi('/auth/refresh', { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })

  return await refreshPromise
}

async function parseJsonResponse(response: Response) {
  const body = await response.json()

  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'La solicitud ha fallado.')
  }

  return body
}
