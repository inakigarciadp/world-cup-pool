import { formatUserErrorMessage } from '@/lib/user-error'

const API_URL = getConvexSiteUrl()
const AUTH_STORAGE_KEY = 'wcp_auth_tokens'
let refreshPromise: Promise<boolean> | null = null

type AuthTokens = {
  accessToken: string
  refreshToken: string
}

type AuthResponse = {
  auth?: Partial<AuthTokens>
}

export type Overview = {
  session: {
    participantId: string
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
    entryId: string | null
    participantId: string
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

export type MatchesPayload = {
  session: {
    participantId: string
    participantName: string
    isAdmin: boolean
  }
  tournamentStarted: boolean
  teams: Array<{
    id: string
    name: string
    fifaCode: string
    groupCode: string
  }>
  eligiblePlayers: Array<{
    id: string
    name: string
    teamId: string | null
    teamName: string
    teamFifaCode: string
  }>
  goalscorerLeaderboard: Array<{
    playerId: string
    playerName: string
    teamId: string | null
    teamName: string
    teamFifaCode: string
    goals: number
  }>
  matches: Match[]
}

export type Match = {
  id: string
  matchNumber: number
  stage: string
  groupName: string | null
  kickoffAt: number
  venueName: string
  venueCity: string
  home: MatchSide
  away: MatchSide
  result: {
    homeGoals: number
    awayGoals: number
    penaltyShootoutWinnerTeamId: string | null
    updatedAt: number
  } | null
  goals: Array<{
    id: string
    scoringTeamId: string
    scoringTeamName: string
    creditedPlayerId: string
    creditedPlayerName: string
    creditedPlayerTeamId: string | null
    creditedPlayerTeamName: string
    isOwnGoal: boolean
    minuteLabel: string | null
    sortOrder: number
  }>
  completeness: {
    expectedGoals: number
    recordedGoals: number
    missingGoals: number
    extraGoals: number
  } | null
  hasCurrentParticipantStake: boolean
  stakes: Array<{
    participantId: string
    participantName: string
    stakes: Array<
      | {
          kind: 'teamPick'
          teamId: string
          teamName: string
          tierName: string
        }
      | {
          kind: 'goalscorerPick'
          eligiblePlayerId: string
          playerName: string
          teamId: string
          teamName: string
          tierName: string
        }
    >
  }>
}

export type MatchSide = {
  placeholder: string
  team: {
    id: string
    name: string
    fifaCode: string
    groupCode: string
  } | null
}

export async function login(loginName: string, pin: string) {
  const response = (await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginName, pin }),
  })) as AuthResponse

  storeAuthTokens(response.auth)
  return response
}

export async function logout() {
  try {
    await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: getStoredAuthTokens()?.refreshToken ?? null }),
    })
  } finally {
    clearAuthTokens()
  }
}

export async function getOverview() {
  const response = await fetchWithRefreshRetry('/api/overview')

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as Overview
}

export async function getMatches(includePast: boolean) {
  const response = await fetchWithRefreshRetry(`/api/matches?includePast=${includePast}`)

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as MatchesPayload
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

export async function updateMatchTeams({
  matchId,
  homeTeamId,
  awayTeamId,
}: {
  matchId: string
  homeTeamId: string | null
  awayTeamId: string | null
}) {
  return await parseJsonResponse(
    await fetchWithRefreshRetry('/api/matches/teams', {
      method: 'POST',
      body: JSON.stringify({ matchId, homeTeamId, awayTeamId }),
    }),
  )
}

export async function saveMatchResult({
  matchId,
  homeGoals,
  awayGoals,
  penaltyShootoutWinnerTeamId,
}: {
  matchId: string
  homeGoals: number | null
  awayGoals: number | null
  penaltyShootoutWinnerTeamId: string | null
}) {
  return await parseJsonResponse(
    await fetchWithRefreshRetry('/api/matches/result', {
      method: 'POST',
      body: JSON.stringify({ matchId, homeGoals, awayGoals, penaltyShootoutWinnerTeamId }),
    }),
  )
}

export async function replaceMatchGoals({
  matchId,
  goals,
}: {
  matchId: string
  goals: Array<{
    scoringTeamId: string
    creditedPlayerId: string
    isOwnGoal: boolean
    minuteLabel: string | null
  }>
}) {
  return await parseJsonResponse(
    await fetchWithRefreshRetry('/api/matches/goals', {
      method: 'POST',
      body: JSON.stringify({ matchId, goals }),
    }),
  )
}

async function request(path: string, init: RequestInit) {
  return await parseJsonResponse(await fetchApi(path, init))
}

async function fetchApi(path: string, init: RequestInit = {}) {
  const authTokens = getStoredAuthTokens()
  const headers = new Headers(init.headers)

  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')

  if (authTokens && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authTokens.accessToken}`)
  }

  return await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
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
  refreshPromise ??= fetchApi('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: getStoredAuthTokens()?.refreshToken ?? null }),
  })
    .then(async (response) => {
      if (!response.ok) {
        clearAuthTokens()
        return false
      }

      const body = (await response.json()) as AuthResponse
      storeAuthTokens(body.auth)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })

  return await refreshPromise
}

async function parseJsonResponse(response: Response) {
  const body = await response.json()

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthTokens()
    }

    throw new Error(
      typeof body.error === 'string'
        ? formatUserErrorMessage(body.error, 'La solicitud ha fallado.')
        : 'La solicitud ha fallado.',
    )
  }

  return body
}

function getConvexSiteUrl() {
  const configuredSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

  if (configuredSiteUrl) {
    return configuredSiteUrl
  }

  if (import.meta.env.PROD) {
    return ''
  }

  return import.meta.env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ?? ''
}

function storeAuthTokens(auth: AuthResponse['auth']) {
  if (!auth?.accessToken || !auth.refreshToken) {
    return
  }

  try {
    getAuthStorage()?.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
      } satisfies AuthTokens),
    )
  } catch {
    // Safari private browsing and locked-down browsers can reject localStorage writes.
  }
}

function getStoredAuthTokens() {
  let storedAuthTokens: string | null | undefined

  try {
    storedAuthTokens = getAuthStorage()?.getItem(AUTH_STORAGE_KEY)
  } catch {
    storedAuthTokens = null
  }

  if (!storedAuthTokens) {
    return null
  }

  try {
    const parsed = JSON.parse(storedAuthTokens) as Partial<AuthTokens>

    return typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string'
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null
  } catch {
    clearAuthTokens()
    return null
  }
}

function clearAuthTokens() {
  try {
    getAuthStorage()?.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures; the server-side session still expires or is revoked.
  }
}

function getAuthStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}
