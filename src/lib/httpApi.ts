import { formatUserErrorMessage } from '@/lib/user-error'

const API_URL = getConvexSiteUrl()
let refreshPromise: Promise<boolean> | null = null

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
  matches: Match[]
}

export type GoalscorersPayload = {
  goalscorerLeaderboard: Array<{
    playerId: string
    playerName: string
    teamId: string | null
    teamName: string
    teamFifaCode: string
    goals: number
    isConfirmedTopScorer: boolean
  }>
}

export type MatchesAdminPayload = {
  teams: TeamOption[]
  eligiblePlayers: EligiblePlayerOption[]
  matches: Array<{
    matchId: string
    completeness: {
      expectedGoals: number
      recordedGoals: number
      missingGoals: number
      extraGoals: number
    } | null
  }>
}

export type GoalscorersAdminPayload = {
  eligiblePlayers: EligiblePlayerOption[]
  topScorerConfirmations: Array<{
    eligiblePlayerId: string
    playerName: string
    teamId: string | null
    teamName: string
    teamFifaCode: string
    confirmedAt: number
  }>
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

export type TeamOption = {
  id: string
  name: string
  fifaCode: string
  groupCode: string
}

export type EligiblePlayerOption = {
  id: string
  name: string
  teamId: string | null
  teamName: string
  teamFifaCode: string
}

export type MatchSide = {
  placeholder: string
  team: TeamOption | null
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

export async function getMatches(includePast: boolean) {
  const response = await fetchWithRefreshRetry(`/api/matches?includePast=${includePast}`)

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as MatchesPayload
}

export async function getGoalscorers() {
  const response = await fetchWithRefreshRetry('/api/goalscorers')

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as GoalscorersPayload
}

export async function getMatchesAdmin(matchId: string) {
  const response = await fetchWithRefreshRetry(
    `/api/matches/admin?matchId=${encodeURIComponent(matchId)}`,
  )

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as MatchesAdminPayload
}

export async function getGoalscorersAdmin() {
  const response = await fetchWithRefreshRetry('/api/goalscorers/admin')

  if (response.status === 401) {
    return null
  }

  return (await parseJsonResponse(response)) as GoalscorersAdminPayload
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

export async function replaceTopScorerConfirmations(eligiblePlayerIds: string[]) {
  return await parseJsonResponse(
    await fetchWithRefreshRetry('/api/top-scorers/confirmations', {
      method: 'POST',
      body: JSON.stringify({ eligiblePlayerIds }),
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
    throw new Error(
      typeof body.error === 'string'
        ? formatUserErrorMessage(body.error, 'La solicitud ha fallado.')
        : 'La solicitud ha fallado.',
    )
  }

  return body
}

function getConvexSiteUrl() {
  if (import.meta.env.VITE_VERCEL_ENV === 'production') {
    return ''
  }

  const configuredSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

  if (configuredSiteUrl) {
    return configuredSiteUrl
  }

  if (import.meta.env.PROD) {
    return ''
  }

  return import.meta.env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ?? ''
}
