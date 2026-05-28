const API_URL = import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL

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
    teams: Array<{
      id: string
      name: string
      fifaCode: string
      groupCode: string
    }>
  }>
  eligiblePlayers: Array<{
    id: string
    name: string
    teamName: string
  }>
  stageBonuses: Array<{
    id: string
    stage: string
    points: number
  }>
  leaderboard: Array<{
    entryId: string
    participantName: string
    goalscorerPick: string | null
    teamPicks: Array<{
      tierName: string
      teamName: string
    }>
    currentScore: number
    submittedAt: number | null
  }>
  currentEntry: {
    teamPickIds: string[]
    goalscorerPickId: string | null
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
  const response = await fetchApi('/api/overview')

  if (response.status === 401) {
    const refreshResponse = await fetchApi('/auth/refresh', { method: 'POST' })

    if (!refreshResponse.ok) {
      return null
    }

    const retryResponse = await fetchApi('/api/overview')

    if (retryResponse.status === 401) {
      return null
    }

    return (await parseJsonResponse(retryResponse)) as Overview
  }

  return (await parseJsonResponse(response)) as Overview
}

export async function saveEntry(teamPickIds: string[], goalscorerPickId: string | null) {
  return await request('/api/entry', {
    method: 'POST',
    body: JSON.stringify({ teamPickIds, goalscorerPickId }),
  })
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

async function parseJsonResponse(response: Response) {
  const body = await response.json()

  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'La solicitud ha fallado.')
  }

  return body
}
