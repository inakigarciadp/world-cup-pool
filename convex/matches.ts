import { v } from 'convex/values'

import { internalMutation, internalQuery, mutation } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireAdminScriptSecret } from './adminScriptAuth'

const DEMO_SLUG = 'world-cup-2026'
const DEFAULT_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000
const MAX_MATCHES = 200
const MAX_GOALS_PER_MATCH = 40
const MAX_TOP_SCORER_CONFIRMATIONS = 200

type AuthenticatedContext = {
  pool: Doc<'pools'>
  participant: Doc<'participants'>
}

type ImportedMatch = {
  fifaMatchId: string
  matchNumber: number
  stage: string
  groupName: string | null
  kickoffAt: number
  venueName: string
  venueCity: string
  homePlaceholder: string
  awayPlaceholder: string
  homeTeamFifaCode: string | null
  awayTeamFifaCode: string | null
  source: string
  sourceUrl: string
  sourceUpdatedAt: number
}

export const getMatchesForHttp = internalQuery({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    includePast: v.boolean(),
    now: v.number(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pool, participant } = await requireAuthenticatedParticipant(ctx, args)
    const earliestKickoffAt = args.now - DEFAULT_MATCH_WINDOW_MS
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_poolId_and_kickoffAt', (q) => {
        const scoped = q.eq('poolId', pool._id)
        return args.includePast ? scoped : scoped.gt('kickoffAt', earliestKickoffAt)
      })
      .take(MAX_MATCHES)
    const [firstMatch] = await ctx.db
      .query('matches')
      .withIndex('by_poolId_and_kickoffAt', (q) => q.eq('poolId', pool._id))
      .take(1)
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(100)
    const tiers = await ctx.db
      .query('teamTiers')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', pool._id))
      .take(25)
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const eligiblePlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const entries = await ctx.db
      .query('entries')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(100)
    const entryTeamPicks = await ctx.db
      .query('entryTeamPicks')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(500)
    const entryGoalscorerPicks = await ctx.db
      .query('entryGoalscorerPicks')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(500)
    const results = await ctx.db
      .query('matchResults')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const goals = await ctx.db
      .query('matchGoals')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const topScorerConfirmations = await ctx.db
      .query('topScorerConfirmations')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_TOP_SCORER_CONFIRMATIONS)

    const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const playersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
    const entriesByParticipantId = new Map(entries.map((entry) => [entry.participantId, entry]))
    const teamPicksByEntryId = groupByEntry(entryTeamPicks)
    const goalscorerPicksByEntryId = groupByEntry(entryGoalscorerPicks)
    const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]))
    const goalsByMatchId = new Map<Id<'matches'>, Doc<'matchGoals'>[]>()
    const confirmedTopScorerIds = new Set(
      topScorerConfirmations.map((confirmation) => confirmation.eligiblePlayerId),
    )

    for (const goal of goals) {
      goalsByMatchId.set(goal.matchId, [...(goalsByMatchId.get(goal.matchId) ?? []), goal])
    }

    const goalsByPlayerId = new Map<Id<'eligiblePlayers'>, number>()

    for (const goal of goals) {
      if (goal.isOwnGoal) {
        continue
      }

      const player = playersById.get(goal.creditedPlayerId) ?? null

      if (player === null || !player.isActive) {
        continue
      }

      goalsByPlayerId.set(
        goal.creditedPlayerId,
        (goalsByPlayerId.get(goal.creditedPlayerId) ?? 0) + 1,
      )
    }

    const goalscorerLeaderboard = Array.from(goalsByPlayerId.entries())
      .map(([playerId, goals]) => {
        const player = playersById.get(playerId)

        if (player === undefined) {
          return null
        }

        const team = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

        return {
          playerId,
          playerName: player.name,
          teamId: team?._id ?? null,
          teamName: team?.name ?? player.teamName,
          teamFifaCode: team?.fifaCode ?? player.teamFifaCode ?? '',
          goals,
          isConfirmedTopScorer: confirmedTopScorerIds.has(playerId),
        }
      })
      .filter(isPresent)
      .sort(
        (left, right) =>
          right.goals - left.goals || left.playerName.localeCompare(right.playerName),
      )

    return {
      session: {
        participantId: participant._id,
        participantName: participant.displayName,
        isAdmin: participant.isAdmin,
      },
      tournamentStarted: firstMatch !== undefined && firstMatch.kickoffAt <= args.now,
      teams: teams
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((team) => ({
          id: team._id,
          name: team.name,
          fifaCode: team.fifaCode,
          groupCode: team.groupCode ?? '?',
        })),
      eligiblePlayers: eligiblePlayers
        .filter((player) => player.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((player) => {
          const team = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)
          return {
            id: player._id,
            name: player.name,
            teamId: team?._id ?? null,
            teamName: team?.name ?? player.teamName,
            teamFifaCode: team?.fifaCode ?? player.teamFifaCode ?? '',
          }
        }),
      goalscorerLeaderboard,
      topScorerConfirmations: topScorerConfirmations
        .map((confirmation) => {
          const player = playersById.get(confirmation.eligiblePlayerId)

          if (player === undefined) {
            return null
          }

          const team = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

          return {
            eligiblePlayerId: confirmation.eligiblePlayerId,
            playerName: player.name,
            teamId: team?._id ?? null,
            teamName: team?.name ?? player.teamName,
            teamFifaCode: team?.fifaCode ?? player.teamFifaCode ?? '',
            confirmedAt: confirmation.confirmedAt,
          }
        })
        .filter(isPresent)
        .sort((left, right) => left.playerName.localeCompare(right.playerName)),
      matches: matches.map((match) => {
        const homeTeam =
          match.homeTeamId === null ? null : (teamsById.get(match.homeTeamId) ?? null)
        const awayTeam =
          match.awayTeamId === null ? null : (teamsById.get(match.awayTeamId) ?? null)
        const result = resultsByMatchId.get(match._id) ?? null
        const matchGoals = (goalsByMatchId.get(match._id) ?? []).sort(
          (left, right) => left.sortOrder - right.sortOrder,
        )
        const expectedGoals = result === null ? 0 : result.homeGoals + result.awayGoals
        const recordedGoals = matchGoals.length
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
              player === null
                ? null
                : resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

            return {
              id: goal._id,
              scoringTeamId: goal.scoringTeamId,
              scoringTeamName: teamsById.get(goal.scoringTeamId)?.name ?? 'Selección desconocida',
              creditedPlayerId: goal.creditedPlayerId,
              creditedPlayerName: player?.name ?? 'Goleador desconocido',
              creditedPlayerTeamId: playerTeam?._id ?? null,
              creditedPlayerTeamName:
                playerTeam?.name ?? player?.teamName ?? 'Selección desconocida',
              isOwnGoal: goal.isOwnGoal,
              minuteLabel: goal.minuteLabel,
              sortOrder: goal.sortOrder,
            }
          }),
          completeness:
            participant.isAdmin && result !== null && expectedGoals !== recordedGoals
              ? {
                  expectedGoals,
                  recordedGoals,
                  missingGoals: Math.max(expectedGoals - recordedGoals, 0),
                  extraGoals: Math.max(recordedGoals - expectedGoals, 0),
                }
              : null,
          hasCurrentParticipantStake: stakes.some(
            (stake) => stake.participantId === participant._id,
          ),
          stakes,
        }
      }),
    }
  },
})

export const updateMatchTeamsForHttp = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    matchId: v.id('matches'),
    homeTeamId: v.union(v.id('teams'), v.null()),
    awayTeamId: v.union(v.id('teams'), v.null()),
  },
  handler: async (ctx, args) => {
    const { pool } = await requireAdminParticipant(ctx, args)
    const match = await requirePoolMatch(ctx, pool._id, args.matchId)
    const homeTeam = await validateOptionalTeam(ctx, pool._id, args.homeTeamId)
    const awayTeam = await validateOptionalTeam(ctx, pool._id, args.awayTeamId)

    if (homeTeam !== null && awayTeam !== null && homeTeam._id === awayTeam._id) {
      throw new Error('Elige dos selecciones distintas.')
    }

    await ctx.db.patch(match._id, {
      homeTeamId: homeTeam?._id ?? null,
      awayTeamId: awayTeam?._id ?? null,
    })

    const result = await ctx.db
      .query('matchResults')
      .withIndex('by_matchId', (q) => q.eq('matchId', match._id))
      .unique()
    const resolvedTeamIds = new Set([homeTeam?._id ?? null, awayTeam?._id ?? null].filter(isTeamId))

    if (
      result !== null &&
      result.penaltyShootoutWinnerTeamId !== null &&
      !resolvedTeamIds.has(result.penaltyShootoutWinnerTeamId)
    ) {
      await ctx.db.patch(result._id, { penaltyShootoutWinnerTeamId: null })
    }

    return { ok: true }
  },
})

export const saveMatchResultForHttp = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    matchId: v.id('matches'),
    homeGoals: v.union(v.number(), v.null()),
    awayGoals: v.union(v.number(), v.null()),
    penaltyShootoutWinnerTeamId: v.union(v.id('teams'), v.null()),
  },
  handler: async (ctx, args) => {
    const { pool, participant } = await requireAdminParticipant(ctx, args)
    const match = await requirePoolMatch(ctx, pool._id, args.matchId)
    const existingResult = await ctx.db
      .query('matchResults')
      .withIndex('by_matchId', (q) => q.eq('matchId', match._id))
      .unique()

    if (args.homeGoals === null && args.awayGoals === null) {
      if (existingResult !== null) {
        await ctx.db.delete(existingResult._id)
      }
      return { ok: true }
    }

    if (args.homeGoals === null || args.awayGoals === null) {
      throw new Error('Introduce los dos marcadores.')
    }

    assertGoalCount(args.homeGoals)
    assertGoalCount(args.awayGoals)

    const resolvedTeamIds = new Set([match.homeTeamId, match.awayTeamId].filter(isTeamId))

    if (args.penaltyShootoutWinnerTeamId !== null) {
      if (args.homeGoals !== args.awayGoals) {
        throw new Error('La tanda de penaltis solo se guarda si el partido acaba empatado.')
      }

      if (!resolvedTeamIds.has(args.penaltyShootoutWinnerTeamId)) {
        throw new Error('El ganador por penaltis debe ser una selección del partido.')
      }
    }

    const payload = {
      poolId: pool._id,
      matchId: match._id,
      homeGoals: args.homeGoals,
      awayGoals: args.awayGoals,
      penaltyShootoutWinnerTeamId: args.penaltyShootoutWinnerTeamId,
      updatedAt: Date.now(),
      updatedByParticipantId: participant._id,
    }

    if (existingResult === null) {
      await ctx.db.insert('matchResults', payload)
    } else {
      await ctx.db.patch(existingResult._id, payload)
    }

    return { ok: true }
  },
})

export const replaceMatchGoalsForHttp = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    matchId: v.id('matches'),
    goals: v.array(
      v.object({
        scoringTeamId: v.id('teams'),
        creditedPlayerId: v.id('eligiblePlayers'),
        isOwnGoal: v.boolean(),
        minuteLabel: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { pool, participant } = await requireAdminParticipant(ctx, args)
    const match = await requirePoolMatch(ctx, pool._id, args.matchId)
    const matchTeamIds = [match.homeTeamId, match.awayTeamId].filter(isTeamId)

    if (matchTeamIds.length === 0 && args.goals.length > 0) {
      throw new Error('Resuelve alguna selección antes de añadir goleadores.')
    }

    if (args.goals.length > MAX_GOALS_PER_MATCH) {
      throw new Error('Hay demasiados goles para este partido.')
    }

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const matchTeamSet = new Set(matchTeamIds)
    const existingGoals = await ctx.db
      .query('matchGoals')
      .withIndex('by_matchId_and_sortOrder', (q) => q.eq('matchId', match._id))
      .take(MAX_GOALS_PER_MATCH)
    const validatedGoals = []

    for (const [index, goal] of args.goals.entries()) {
      if (!matchTeamSet.has(goal.scoringTeamId)) {
        throw new Error('La selección que marca debe jugar el partido.')
      }

      const player = await ctx.db.get(goal.creditedPlayerId)

      if (player === null || player.poolId !== pool._id || !player.isActive) {
        throw new Error('El goleador debe ser un jugador elegible.')
      }

      const creditedTeam = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

      if (creditedTeam === null || !matchTeamSet.has(creditedTeam._id)) {
        throw new Error('El goleador debe pertenecer a una selección del partido.')
      }

      if (!goal.isOwnGoal && creditedTeam._id !== goal.scoringTeamId) {
        throw new Error('En un gol normal, el goleador debe ser de la selección que marca.')
      }

      if (goal.isOwnGoal && creditedTeam._id === goal.scoringTeamId) {
        throw new Error('En un gol en propia, el jugador acreditado debe ser del rival.')
      }

      const minuteLabel = normalizeMinuteLabel(goal.minuteLabel)

      validatedGoals.push({
        poolId: pool._id,
        matchId: match._id,
        scoringTeamId: goal.scoringTeamId,
        creditedPlayerId: player._id,
        isOwnGoal: goal.isOwnGoal,
        minuteLabel,
        sortOrder: index,
        updatedAt: Date.now(),
        updatedByParticipantId: participant._id,
      })
    }

    for (const goal of existingGoals) {
      await ctx.db.delete(goal._id)
    }

    for (const goal of validatedGoals) {
      await ctx.db.insert('matchGoals', goal)
    }

    return { ok: true }
  },
})

export const replaceTopScorerConfirmationsForHttp = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    eligiblePlayerIds: v.array(v.id('eligiblePlayers')),
  },
  handler: async (ctx, args) => {
    const { pool, participant } = await requireAdminParticipant(ctx, args)
    const uniquePlayerIds = Array.from(new Set(args.eligiblePlayerIds))

    if (uniquePlayerIds.length > MAX_TOP_SCORER_CONFIRMATIONS) {
      throw new Error('Hay demasiados goleadores confirmados.')
    }

    for (const eligiblePlayerId of uniquePlayerIds) {
      const player = await ctx.db.get(eligiblePlayerId)

      if (player === null || player.poolId !== pool._id || !player.isActive) {
        throw new Error('El goleador confirmado debe ser un jugador elegible.')
      }
    }

    const existingConfirmations = await ctx.db
      .query('topScorerConfirmations')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_TOP_SCORER_CONFIRMATIONS)

    for (const confirmation of existingConfirmations) {
      await ctx.db.delete(confirmation._id)
    }

    const now = Date.now()

    for (const eligiblePlayerId of uniquePlayerIds) {
      await ctx.db.insert('topScorerConfirmations', {
        poolId: pool._id,
        eligiblePlayerId,
        confirmedAt: now,
        confirmedByParticipantId: participant._id,
      })
    }

    return { ok: true }
  },
})

export const importFifaMatchesForAdmin = mutation({
  args: {
    scriptSecret: v.string(),
    slug: v.optional(v.string()),
    matches: v.array(
      v.object({
        fifaMatchId: v.string(),
        matchNumber: v.number(),
        stage: v.string(),
        groupName: v.union(v.string(), v.null()),
        kickoffAt: v.number(),
        venueName: v.string(),
        venueCity: v.string(),
        homePlaceholder: v.string(),
        awayPlaceholder: v.string(),
        homeTeamFifaCode: v.union(v.string(), v.null()),
        awayTeamFifaCode: v.union(v.string(), v.null()),
        source: v.string(),
        sourceUrl: v.string(),
        sourceUpdatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminScriptSecret(args.scriptSecret)

    const pool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
      .unique()

    if (pool === null) {
      throw new Error('No se ha encontrado la porra. Sincroniza participantes primero.')
    }

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const existingMatches = await ctx.db
      .query('matches')
      .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', pool._id))
      .take(MAX_MATCHES)
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode.toUpperCase(), team]))
    const existingByMatchNumber = new Map(
      existingMatches.map((match) => [match.matchNumber, match]),
    )
    let inserted = 0
    let updated = 0

    for (const imported of args.matches) {
      validateImportedMatch(imported)

      const existing = existingByMatchNumber.get(imported.matchNumber) ?? null
      const homeTeam = resolveImportedTeam(teamsByCode, imported.homeTeamFifaCode)
      const awayTeam = resolveImportedTeam(teamsByCode, imported.awayTeamFifaCode)
      const payload = {
        poolId: pool._id,
        matchNumber: imported.matchNumber,
        fifaMatchId: imported.fifaMatchId,
        stage: imported.stage,
        groupName: imported.groupName,
        kickoffAt: imported.kickoffAt,
        venueName: imported.venueName,
        venueCity: imported.venueCity,
        homePlaceholder: imported.homePlaceholder,
        awayPlaceholder: imported.awayPlaceholder,
        homeTeamId: homeTeam?._id ?? existing?.homeTeamId ?? null,
        awayTeamId: awayTeam?._id ?? existing?.awayTeamId ?? null,
        source: imported.source,
        sourceUrl: imported.sourceUrl,
        sourceUpdatedAt: imported.sourceUpdatedAt,
      }

      if (existing === null) {
        const matchId = await ctx.db.insert('matches', payload)
        const created = await ctx.db.get(matchId)
        if (created !== null) {
          existingByMatchNumber.set(imported.matchNumber, created)
        }
        inserted += 1
      } else {
        await ctx.db.patch(existing._id, payload)
        updated += 1
      }
    }

    return {
      poolId: pool._id,
      received: args.matches.length,
      inserted,
      updated,
    }
  },
})

async function requireAuthenticatedParticipant(
  ctx: QueryCtx | MutationCtx,
  args: {
    poolId: Id<'pools'>
    participantId: Id<'participants'>
    slug?: string
  },
): Promise<AuthenticatedContext> {
  const pool = await ctx.db
    .query('pools')
    .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
    .unique()

  if (pool === null || pool._id !== args.poolId) {
    throw new Error('No autorizado.')
  }

  const participant = await ctx.db.get(args.participantId)

  if (participant === null || participant.poolId !== pool._id) {
    throw new Error('No autorizado.')
  }

  return { pool, participant }
}

async function requireAdminParticipant(
  ctx: MutationCtx,
  args: {
    poolId: Id<'pools'>
    participantId: Id<'participants'>
  },
) {
  const context = await requireAuthenticatedParticipant(ctx, args)

  if (!context.participant.isAdmin) {
    throw new Error('Solo el admin puede editar partidos.')
  }

  return context
}

async function requirePoolMatch(
  ctx: QueryCtx | MutationCtx,
  poolId: Id<'pools'>,
  matchId: Id<'matches'>,
) {
  const match = await ctx.db.get(matchId)

  if (match === null || match.poolId !== poolId) {
    throw new Error('No se ha encontrado el partido.')
  }

  return match
}

async function validateOptionalTeam(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  teamId: Id<'teams'> | null,
) {
  if (teamId === null) {
    return null
  }

  const team = await ctx.db.get(teamId)

  if (team === null || team.poolId !== poolId) {
    throw new Error('Elige una selección válida.')
  }

  return team
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

function groupByEntry<T extends { entryId: Id<'entries'> }>(rows: T[]) {
  const byEntryId = new Map<Id<'entries'>, T[]>()

  for (const row of rows) {
    byEntryId.set(row.entryId, [...(byEntryId.get(row.entryId) ?? []), row])
  }

  return byEntryId
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

function isTeamId(teamId: Id<'teams'> | null): teamId is Id<'teams'> {
  return teamId !== null
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}

function assertGoalCount(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error('El marcador debe ser un número entero entre 0 y 99.')
  }
}

function normalizeMinuteLabel(value: string | null) {
  const trimmed = value?.trim() ?? ''

  if (trimmed.length > 12) {
    throw new Error('El minuto es demasiado largo.')
  }

  return trimmed.length > 0 ? trimmed : null
}

function validateImportedMatch(match: ImportedMatch) {
  if (!Number.isInteger(match.matchNumber) || match.matchNumber < 1 || match.matchNumber > 104) {
    throw new Error('El número de partido importado no es válido.')
  }

  if (!Number.isFinite(match.kickoffAt) || match.kickoffAt <= 0) {
    throw new Error(`El partido ${match.matchNumber} no tiene una fecha válida.`)
  }

  for (const field of [
    match.fifaMatchId,
    match.stage,
    match.venueName,
    match.venueCity,
    match.homePlaceholder,
    match.awayPlaceholder,
    match.source,
    match.sourceUrl,
  ]) {
    if (field.trim().length === 0) {
      throw new Error(`El partido ${match.matchNumber} tiene datos incompletos.`)
    }
  }
}

function resolveImportedTeam(teamsByCode: Map<string, Doc<'teams'>>, fifaCode: string | null) {
  if (fifaCode === null) {
    return null
  }

  const team = teamsByCode.get(fifaCode.trim().toUpperCase())

  if (team === undefined) {
    throw new Error(`No existe la selección ${fifaCode} en la porra.`)
  }

  return team
}
