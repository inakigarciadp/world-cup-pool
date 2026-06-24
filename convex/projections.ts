import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { calculateLeaderboardScores, type EntryScore } from './scoring'

const MAX_PARTICIPANTS = 100
const MAX_TIERS = 25
const MAX_TEAMS = 200
const MAX_ELIGIBLE_PLAYERS = 2000
const MAX_ENTRIES = 200
const MAX_PICKS = 1000
const MAX_MATCHES = 200
const MAX_RESULTS = 200
const MAX_GOALS = 3000
const MAX_TOP_SCORER_CONFIRMATIONS = 200

type ProjectionRefreshOptions = {
  updatedAt: number
  updatedByParticipantId: Id<'participants'> | null
}

export async function refreshHotPathProjections(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  updatedByParticipantId: Id<'participants'> | null,
) {
  const options = {
    updatedAt: Date.now(),
    updatedByParticipantId,
  }

  const leaderboard = await refreshLeaderboardProjection(ctx, poolId, options)
  const entries = await refreshEntriesProjection(ctx, poolId, options)
  const matches = await refreshMatchProjections(ctx, poolId, options)

  return { leaderboard, entries, matches }
}

export async function refreshLeaderboardProjection(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  options: ProjectionRefreshOptions,
) {
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PARTICIPANTS)
  const tiers = await ctx.db
    .query('teamTiers')
    .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', poolId))
    .take(MAX_TIERS)
  const entries = await ctx.db
    .query('entries')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_ENTRIES)
  const teamPicks = await ctx.db
    .query('entryTeamPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const goalscorerPicks = await ctx.db
    .query('entryGoalscorerPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const matches = await ctx.db
    .query('matches')
    .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', poolId))
    .take(MAX_MATCHES)
  const results = await ctx.db
    .query('matchResults')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_RESULTS)
  const goals = await ctx.db
    .query('matchGoals')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_GOALS)
  const topScorerConfirmations = await ctx.db
    .query('topScorerConfirmations')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_TOP_SCORER_CONFIRMATIONS)
  const scores: EntryScore[] = calculateLeaderboardScores({
    entries,
    tiers,
    teamPicks,
    goalscorerPicks,
    matches,
    results,
    goals,
    topScorerConfirmations,
  })
  const scoresByEntryId = new Map(scores.map((score) => [score.entryId, score.currentScore]))
  const payload = {
    poolId,
    teamTiers: serializeRuleTeamTiers(tiers),
    leaderboard: buildLeaderboard({ participants, entries, scoresByEntryId }),
    updatedAt: options.updatedAt,
    updatedByParticipantId: options.updatedByParticipantId,
  }
  const existing = await ctx.db
    .query('leaderboardProjections')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .unique()

  if (existing === null) {
    await ctx.db.insert('leaderboardProjections', payload)
  } else {
    await ctx.db.patch(existing._id, payload)
  }

  return {
    teamTiers: payload.teamTiers.length,
    leaderboardEntries: payload.leaderboard.length,
  }
}

export async function refreshEntriesProjection(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  options: ProjectionRefreshOptions,
) {
  const pool = await ctx.db.get(poolId)

  if (pool === null) {
    throw new Error('No se ha encontrado la porra.')
  }

  const participants = await ctx.db
    .query('participants')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PARTICIPANTS)
  const tiers = await ctx.db
    .query('teamTiers')
    .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', poolId))
    .take(MAX_TIERS)
  const teams = await ctx.db
    .query('teams')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_TEAMS)
  const entries = await ctx.db
    .query('entries')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_ENTRIES)
  const teamPicks = await ctx.db
    .query('entryTeamPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const goalscorerPicks = await ctx.db
    .query('entryGoalscorerPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const matches = await ctx.db
    .query('matches')
    .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', poolId))
    .take(MAX_MATCHES)
  const results = await ctx.db
    .query('matchResults')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_RESULTS)
  const goals = await ctx.db
    .query('matchGoals')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_GOALS)
  const topScorerConfirmations = await ctx.db
    .query('topScorerConfirmations')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_TOP_SCORER_CONFIRMATIONS)
  const scores: EntryScore[] = calculateLeaderboardScores({
    entries,
    tiers,
    teamPicks,
    goalscorerPicks,
    matches,
    results,
    goals,
    topScorerConfirmations,
  })
  const selectedEligiblePlayers = await getSelectedEligiblePlayers(ctx, poolId, goalscorerPicks)
  const scoresByEntryId = new Map(scores.map((score) => [score.entryId, score.currentScore]))
  const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
  const teamsById = new Map(teams.map((team) => [team._id, team]))
  const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
  const teamsByName = new Map(teams.map((team) => [team.name, team]))
  const eligiblePlayersById = new Map(selectedEligiblePlayers.map((player) => [player._id, player]))
  const teamPicksByEntryId = groupByEntry(teamPicks)
  const goalscorerPicksByEntryId = groupByEntry(goalscorerPicks)
  const payload = {
    poolId,
    pool: {
      entryLockAt: pool.entryLockAt,
      status: pool.status,
    },
    teamTiers: serializeEntryTeamTiers(tiers, teams),
    eligiblePlayers: serializeEntryEligiblePlayers({
      eligiblePlayers: selectedEligiblePlayers,
      teamsById,
      teamsByCode,
      teamsByName,
      activeOnly: false,
    }),
    leaderboard: buildEntryOverviews({
      participants,
      entries,
      teamPicksByEntryId,
      goalscorerPicksByEntryId,
      tiersById,
      teamsById,
      eligiblePlayersById,
      scoresByEntryId,
    }),
    currentEntries: buildCurrentEntries({
      entries,
      teamPicksByEntryId,
      goalscorerPicksByEntryId,
      tiersById,
      teamsById,
      eligiblePlayersById,
    }),
    updatedAt: options.updatedAt,
    updatedByParticipantId: options.updatedByParticipantId,
  }
  const existing = await ctx.db
    .query('entriesProjections')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .unique()

  if (existing === null) {
    await ctx.db.insert('entriesProjections', payload)
  } else {
    await ctx.db.patch(existing._id, payload)
  }

  return {
    teamTiers: payload.teamTiers.length,
    eligiblePlayers: payload.eligiblePlayers.length,
    leaderboardEntries: payload.leaderboard.length,
    currentEntries: payload.currentEntries.length,
  }
}

export async function refreshMatchProjections(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  options: ProjectionRefreshOptions,
) {
  const matches = await ctx.db
    .query('matches')
    .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', poolId))
    .take(MAX_MATCHES)
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PARTICIPANTS)
  const tiers = await ctx.db
    .query('teamTiers')
    .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', poolId))
    .take(MAX_TIERS)
  const teams = await ctx.db
    .query('teams')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_TEAMS)
  const eligiblePlayers = await ctx.db
    .query('eligiblePlayers')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_ELIGIBLE_PLAYERS)
  const entries = await ctx.db
    .query('entries')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_ENTRIES)
  const teamPicks = await ctx.db
    .query('entryTeamPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const goalscorerPicks = await ctx.db
    .query('entryGoalscorerPicks')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_PICKS)
  const results = await ctx.db
    .query('matchResults')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_RESULTS)
  const goals = await ctx.db
    .query('matchGoals')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(MAX_GOALS)
  const existingProjections = await ctx.db
    .query('matchProjections')
    .withIndex('by_poolId_and_kickoffAt', (q) => q.eq('poolId', poolId))
    .take(MAX_MATCHES)

  const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
  const teamsById = new Map(teams.map((team) => [team._id, team]))
  const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
  const teamsByName = new Map(teams.map((team) => [team.name, team]))
  const playersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
  const entriesByParticipantId = new Map(entries.map((entry) => [entry.participantId, entry]))
  const teamPicksByEntryId = groupByEntry(teamPicks)
  const goalscorerPicksByEntryId = groupByEntry(goalscorerPicks)
  const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]))
  const goalsByMatchId = new Map<Id<'matches'>, Doc<'matchGoals'>[]>()
  const existingByMatchId = new Map(
    existingProjections.map((projection) => [projection.matchId, projection]),
  )
  const matchIds = new Set(matches.map((match) => match._id))
  let upserted = 0
  let deleted = 0

  for (const goal of goals) {
    goalsByMatchId.set(goal.matchId, [...(goalsByMatchId.get(goal.matchId) ?? []), goal])
  }

  for (const projection of existingProjections) {
    if (!matchIds.has(projection.matchId)) {
      await ctx.db.delete(projection._id)
      deleted += 1
    }
  }

  for (const match of matches) {
    const { card, stakeParticipantIds } = buildMatchProjection({
      match,
      participants,
      entriesByParticipantId,
      teamPicksByEntryId,
      goalscorerPicksByEntryId,
      tiersById,
      teamsById,
      teamsByCode,
      teamsByName,
      playersById,
      result: resultsByMatchId.get(match._id) ?? null,
      goals: goalsByMatchId.get(match._id) ?? [],
    })
    const payload = {
      poolId,
      matchId: match._id,
      kickoffAt: match.kickoffAt,
      matchNumber: match.matchNumber,
      card,
      stakeParticipantIds,
      updatedAt: options.updatedAt,
      updatedByParticipantId: options.updatedByParticipantId,
    }
    const existing = existingByMatchId.get(match._id) ?? null

    if (existing === null) {
      await ctx.db.insert('matchProjections', payload)
    } else {
      await ctx.db.patch(existing._id, payload)
    }

    upserted += 1
  }

  return { upserted, deleted }
}

async function getSelectedEligiblePlayers(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  goalscorerPicks: Doc<'entryGoalscorerPicks'>[],
) {
  const eligiblePlayerIds = Array.from(
    new Set(goalscorerPicks.map((pick) => pick.eligiblePlayerId)),
  )
  const players = await Promise.all(
    eligiblePlayerIds.map(async (eligiblePlayerId) => await ctx.db.get(eligiblePlayerId)),
  )

  return players.filter(
    (player): player is Doc<'eligiblePlayers'> => player !== null && player.poolId === poolId,
  )
}

function buildLeaderboard({
  participants,
  entries,
  scoresByEntryId,
}: {
  participants: Doc<'participants'>[]
  entries: Doc<'entries'>[]
  scoresByEntryId: Map<Id<'entries'>, number>
}) {
  const entriesByParticipantId = new Map(entries.map((entry) => [entry.participantId, entry]))

  return sortLeaderboard(
    participants.map((participant) => {
      const entry = entriesByParticipantId.get(participant._id) ?? null

      return {
        entryId: entry?._id ?? null,
        participantId: participant._id,
        participantName: participant.displayName,
        currentScore: entry === null ? 0 : (scoresByEntryId.get(entry._id) ?? 0),
        submittedAt: entry?.submittedAt ?? null,
      }
    }),
  )
}

function buildEntryOverviews({
  participants,
  entries,
  teamPicksByEntryId,
  goalscorerPicksByEntryId,
  tiersById,
  teamsById,
  eligiblePlayersById,
  scoresByEntryId,
}: {
  participants: Doc<'participants'>[]
  entries: Doc<'entries'>[]
  teamPicksByEntryId: Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>
  goalscorerPicksByEntryId: Map<Id<'entries'>, Doc<'entryGoalscorerPicks'>[]>
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  eligiblePlayersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  scoresByEntryId: Map<Id<'entries'>, number>
}) {
  const entriesByParticipantId = new Map(entries.map((entry) => [entry.participantId, entry]))

  return sortLeaderboard(
    participants.map((participant) => {
      const entry = entriesByParticipantId.get(participant._id) ?? null
      const goalscorerPicks = (
        entry === null ? [] : (goalscorerPicksByEntryId.get(entry._id) ?? [])
      )
        .map((pick) => {
          const tier = tiersById.get(pick.tierId)
          const player = eligiblePlayersById.get(pick.eligiblePlayerId)

          return {
            tierName: tier?.name ?? 'Bombo desconocido',
            playerName: player?.name ?? 'Goleador desconocido',
            teamName: player?.teamName ?? 'Selección desconocida',
            sortOrder: tier?.sortOrder ?? 999,
          }
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.playerName.localeCompare(right.playerName),
        )
        .map(({ tierName, playerName, teamName }) => ({ tierName, playerName, teamName }))
      const teamPicks = (entry === null ? [] : (teamPicksByEntryId.get(entry._id) ?? []))
        .map((pick) => {
          const tier = tiersById.get(pick.tierId)
          const team = teamsById.get(pick.teamId)

          return {
            tierName: tier?.name ?? 'Bombo desconocido',
            teamName: team?.name ?? 'Selección desconocida',
            sortOrder: tier?.sortOrder ?? 999,
          }
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.teamName.localeCompare(right.teamName),
        )
        .map(({ tierName, teamName }) => ({ tierName, teamName }))

      return {
        entryId: entry?._id ?? null,
        participantId: participant._id,
        participantName: participant.displayName,
        goalscorerPicks,
        teamPicks,
        currentScore: entry === null ? 0 : (scoresByEntryId.get(entry._id) ?? 0),
        submittedAt: entry?.submittedAt ?? null,
      }
    }),
  )
}

function buildCurrentEntries({
  entries,
  teamPicksByEntryId,
  goalscorerPicksByEntryId,
  tiersById,
  teamsById,
  eligiblePlayersById,
}: {
  entries: Doc<'entries'>[]
  teamPicksByEntryId: Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>
  goalscorerPicksByEntryId: Map<Id<'entries'>, Doc<'entryGoalscorerPicks'>[]>
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  eligiblePlayersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
}) {
  return entries.map((entry) => ({
    participantId: entry.participantId,
    teamPickIds: (teamPicksByEntryId.get(entry._id) ?? [])
      .map((pick) => {
        const tier = tiersById.get(pick.tierId)
        const team = teamsById.get(pick.teamId)

        return {
          teamId: pick.teamId,
          teamName: team?.name ?? 'Selección desconocida',
          sortOrder: tier?.sortOrder ?? 999,
        }
      })
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.teamName.localeCompare(right.teamName),
      )
      .map(({ teamId }) => teamId),
    goalscorerPickIds: (goalscorerPicksByEntryId.get(entry._id) ?? [])
      .map((pick) => {
        const tier = tiersById.get(pick.tierId)
        const player = eligiblePlayersById.get(pick.eligiblePlayerId)

        return {
          tierId: pick.tierId,
          eligiblePlayerId: pick.eligiblePlayerId,
          playerName: player?.name ?? 'Goleador desconocido',
          sortOrder: tier?.sortOrder ?? 999,
        }
      })
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.playerName.localeCompare(right.playerName),
      )
      .map(({ tierId, eligiblePlayerId }) => ({ tierId, eligiblePlayerId })),
  }))
}

function sortLeaderboard<
  T extends { entryId: Id<'entries'> | null; currentScore: number; participantName: string },
>(entries: T[]) {
  return entries.sort(
    (left, right) =>
      Number(right.entryId !== null) - Number(left.entryId !== null) ||
      right.currentScore - left.currentScore ||
      left.participantName.localeCompare(right.participantName),
  )
}

function serializeRuleTeamTiers(tiers: Doc<'teamTiers'>[]) {
  return tiers.map((tier) => ({
    id: tier._id,
    name: tier.name,
    requiredPicks: tier.requiredPicks,
    multiplier: tier.multiplier ?? null,
  }))
}

function serializeEntryTeamTiers(tiers: Doc<'teamTiers'>[], teams: Doc<'teams'>[]) {
  return tiers.map((tier) => ({
    id: tier._id,
    name: tier.name,
    requiredPicks: tier.requiredPicks,
    multiplier: tier.multiplier ?? null,
    teams: teams
      .filter((team) => team.tierId === tier._id)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((team) => ({
        id: team._id,
        name: team.name,
        fifaCode: team.fifaCode,
        groupCode: team.groupCode ?? '?',
      })),
  }))
}

export function serializeEntryEligiblePlayers({
  eligiblePlayers,
  teamsById,
  teamsByCode,
  teamsByName,
  activeOnly,
}: {
  eligiblePlayers: Doc<'eligiblePlayers'>[]
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
  activeOnly: boolean
}) {
  return eligiblePlayers
    .filter((player) => !activeOnly || player.isActive)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((player) => {
      const team = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

      return {
        id: player._id,
        name: player.name,
        teamId: team?._id ?? null,
        tierId: team?.tierId ?? null,
        teamName: team?.name ?? player.teamName,
        teamFifaCode: team?.fifaCode ?? player.teamFifaCode ?? '',
        groupCode: team?.groupCode ?? '?',
      }
    })
}

function buildMatchProjection({
  match,
  participants,
  entriesByParticipantId,
  teamPicksByEntryId,
  goalscorerPicksByEntryId,
  tiersById,
  teamsById,
  teamsByCode,
  teamsByName,
  playersById,
  result,
  goals,
}: {
  match: Doc<'matches'>
  participants: Doc<'participants'>[]
  entriesByParticipantId: Map<Id<'participants'>, Doc<'entries'>>
  teamPicksByEntryId: Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>
  goalscorerPicksByEntryId: Map<Id<'entries'>, Doc<'entryGoalscorerPicks'>[]>
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  result: Doc<'matchResults'> | null
  goals: Doc<'matchGoals'>[]
}) {
  const homeTeam = match.homeTeamId === null ? null : (teamsById.get(match.homeTeamId) ?? null)
  const awayTeam = match.awayTeamId === null ? null : (teamsById.get(match.awayTeamId) ?? null)
  const matchGoals = [...goals].sort((left, right) => left.sortOrder - right.sortOrder)
  const stakes = buildMatchStakes({
    matchTeamIds: [match.homeTeamId, match.awayTeamId].filter(isTeamId),
    participants,
    entriesByParticipantId,
    teamPicksByEntryId,
    goalscorerPicksByEntryId,
    tiersById,
    teamsById,
    teamsByCode,
    teamsByName,
    playersById,
  })

  return {
    card: {
      id: match._id,
      matchNumber: match.matchNumber,
      stage: match.stage,
      groupName: match.groupName,
      kickoffAt: match.kickoffAt,
      venueName: match.venueName,
      venueCity: match.venueCity,
      home: {
        placeholder: match.homePlaceholder,
        team: serializeTeam(homeTeam),
      },
      away: {
        placeholder: match.awayPlaceholder,
        team: serializeTeam(awayTeam),
      },
      result:
        result === null
          ? null
          : {
              homeGoals: result.homeGoals,
              awayGoals: result.awayGoals,
              penaltyShootoutWinnerTeamId: result.penaltyShootoutWinnerTeamId,
              updatedAt: result.updatedAt,
            },
      goals: matchGoals.map((goal) => {
        const player = playersById.get(goal.creditedPlayerId) ?? null
        const playerTeam =
          player === null ? null : resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

        return {
          id: goal._id,
          scoringTeamId: goal.scoringTeamId,
          scoringTeamName: teamsById.get(goal.scoringTeamId)?.name ?? 'Selección desconocida',
          creditedPlayerId: goal.creditedPlayerId,
          creditedPlayerName: player?.name ?? 'Goleador desconocido',
          creditedPlayerTeamId: playerTeam?._id ?? null,
          creditedPlayerTeamName: playerTeam?.name ?? player?.teamName ?? 'Selección desconocida',
          isOwnGoal: goal.isOwnGoal,
          minuteLabel: goal.minuteLabel,
          sortOrder: goal.sortOrder,
        }
      }),
      stakes,
    },
    stakeParticipantIds: stakes.map((stake) => stake.participantId),
  }
}

function buildMatchStakes({
  matchTeamIds,
  participants,
  entriesByParticipantId,
  teamPicksByEntryId,
  goalscorerPicksByEntryId,
  tiersById,
  teamsById,
  teamsByCode,
  teamsByName,
  playersById,
}: {
  matchTeamIds: Id<'teams'>[]
  participants: Doc<'participants'>[]
  entriesByParticipantId: Map<Id<'participants'>, Doc<'entries'>>
  teamPicksByEntryId: Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>
  goalscorerPicksByEntryId: Map<Id<'entries'>, Doc<'entryGoalscorerPicks'>[]>
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
}) {
  const matchTeamSet = new Set(matchTeamIds)

  if (matchTeamSet.size === 0) {
    return []
  }

  return participants
    .map((participant) => {
      const entry = entriesByParticipantId.get(participant._id)

      if (entry === undefined) {
        return null
      }

      const stakes = []

      for (const pick of teamPicksByEntryId.get(entry._id) ?? []) {
        if (!matchTeamSet.has(pick.teamId)) {
          continue
        }

        const team = teamsById.get(pick.teamId)
        const tier = tiersById.get(pick.tierId)

        stakes.push({
          kind: 'teamPick' as const,
          teamId: pick.teamId,
          teamName: team?.name ?? 'Selección desconocida',
          tierName: tier?.name ?? 'Bombo',
        })
      }

      for (const pick of goalscorerPicksByEntryId.get(entry._id) ?? []) {
        const player = playersById.get(pick.eligiblePlayerId)

        if (player === undefined) {
          continue
        }

        const playerTeam = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

        if (playerTeam === null || !matchTeamSet.has(playerTeam._id)) {
          continue
        }

        const tier = tiersById.get(pick.tierId)

        stakes.push({
          kind: 'goalscorerPick' as const,
          eligiblePlayerId: pick.eligiblePlayerId,
          playerName: player.name,
          teamId: playerTeam._id,
          teamName: playerTeam.name,
          tierName: tier?.name ?? 'Bombo',
        })
      }

      if (stakes.length === 0) {
        return null
      }

      return {
        participantId: participant._id,
        participantName: participant.displayName,
        stakes,
      }
    })
    .filter(isPresent)
    .sort((left, right) => left.participantName.localeCompare(right.participantName))
}

function serializeTeam(team: Doc<'teams'> | null) {
  if (team === null) {
    return null
  }

  return {
    id: team._id,
    name: team.name,
    fifaCode: team.fifaCode,
    groupCode: team.groupCode ?? '?',
  }
}

function resolvePlayerTeam(
  player: Doc<'eligiblePlayers'>,
  teamsById: Map<Id<'teams'>, Doc<'teams'>>,
  teamsByCode: Map<string, Doc<'teams'>>,
  teamsByName: Map<string, Doc<'teams'>>,
) {
  return (
    (player.teamId === undefined ? undefined : teamsById.get(player.teamId)) ??
    (player.teamFifaCode === undefined ? undefined : teamsByCode.get(player.teamFifaCode)) ??
    teamsByName.get(player.teamName) ??
    null
  )
}

function groupByEntry<T extends { entryId: Id<'entries'> }>(rows: T[]) {
  const byEntryId = new Map<Id<'entries'>, T[]>()

  for (const row of rows) {
    byEntryId.set(row.entryId, [...(byEntryId.get(row.entryId) ?? []), row])
  }

  return byEntryId
}

function isTeamId(teamId: Id<'teams'> | null): teamId is Id<'teams'> {
  return teamId !== null
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}
