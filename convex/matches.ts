import { v } from 'convex/values'

import { internalMutation, internalQuery, mutation } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireAdminScriptSecret } from './adminScriptAuth'

const DEMO_SLUG = 'world-cup-2026'
const DEFAULT_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000
const DEFAULT_TOURNAMENT_RESULT_SEED = 'world-cup-pool-2026-dev-results-v1'
const MAX_MATCHES = 200
const MAX_GOALS_PER_MATCH = 40
const MAX_TOP_SCORER_CONFIRMATIONS = 200
const MAX_SEED_PLAYERS = 2500
const MAX_SEED_PARTICIPANTS = 100
const MAX_SEED_WARNINGS = 20
const THIRD_PLACE_QUALIFIERS = 8

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

type GroupStats = {
  team: Doc<'teams'>
  played: number
  wins: number
  draws: number
  losses: number
  points: number
  goalsFor: number
  goalsAgainst: number
}

type GroupRankingContext = {
  rankingsByGroup: Map<string, GroupStats[]>
  thirdPlaceCandidates: GroupStats[]
}

type GeneratedResult = {
  homeGoals: number
  awayGoals: number
  penaltyShootoutWinnerTeamId: Id<'teams'> | null
  winnerTeamId: Id<'teams'> | null
  loserTeamId: Id<'teams'> | null
}

type GeneratedGoal = {
  scoringTeamId: Id<'teams'>
  creditedPlayerId: Id<'eligiblePlayers'>
  isOwnGoal: boolean
  minuteLabel: string
  sortOrder: number
}

type SeedPlayerState = {
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  playersByTeamId: Map<Id<'teams'>, Doc<'eligiblePlayers'>[]>
  playersByTeamAndName: Map<string, Doc<'eligiblePlayers'>>
  insertedPlaceholderPlayers: number
  activatedPlaceholderPlayers: number
}

type GeneratedTopScorer = {
  player: Doc<'eligiblePlayers'>
  team: Doc<'teams'> | null
  goals: number
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
    const results = (
      await Promise.all(
        matches.map((match) =>
          ctx.db
            .query('matchResults')
            .withIndex('by_matchId', (q) => q.eq('matchId', match._id))
            .unique(),
        ),
      )
    ).filter(isPresent)
    const goals = (
      await Promise.all(
        matches.map((match) =>
          ctx.db
            .query('matchGoals')
            .withIndex('by_matchId_and_sortOrder', (q) => q.eq('matchId', match._id))
            .take(MAX_GOALS_PER_MATCH),
        ),
      )
    ).flat()

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

    for (const goal of goals) {
      goalsByMatchId.set(goal.matchId, [...(goalsByMatchId.get(goal.matchId) ?? []), goal])
    }

    return {
      session: {
        participantId: participant._id,
        participantName: participant.displayName,
        isAdmin: participant.isAdmin,
      },
      tournamentStarted: firstMatch !== undefined && firstMatch.kickoffAt <= args.now,
      matches: matches.map((match) => {
        const homeTeam =
          match.homeTeamId === null ? null : (teamsById.get(match.homeTeamId) ?? null)
        const awayTeam =
          match.awayTeamId === null ? null : (teamsById.get(match.awayTeamId) ?? null)
        const result = resultsByMatchId.get(match._id) ?? null
        const matchGoals = (goalsByMatchId.get(match._id) ?? []).sort(
          (left, right) => left.sortOrder - right.sortOrder,
        )
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
          hasCurrentParticipantStake: stakes.some(
            (stake) => stake.participantId === participant._id,
          ),
          stakes,
        }
      }),
    }
  },
})

export const getGoalscorersForHttp = internalQuery({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pool } = await requireAuthenticatedParticipant(ctx, args)
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const eligiblePlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const goals = await ctx.db
      .query('matchGoals')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const topScorerConfirmations = await ctx.db
      .query('topScorerConfirmations')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_TOP_SCORER_CONFIRMATIONS)
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const playersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
    const confirmedTopScorerIds = new Set(
      topScorerConfirmations.map((confirmation) => confirmation.eligiblePlayerId),
    )

    return {
      goalscorerLeaderboard: buildGoalscorerLeaderboard({
        goals,
        playersById,
        teamsById,
        teamsByCode,
        teamsByName,
        confirmedTopScorerIds,
      }),
    }
  },
})

export const getMatchAdminForHttp = internalQuery({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    matchId: v.id('matches'),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pool } = await requireAdminParticipant(ctx, args)
    const match = await ctx.db.get(args.matchId)

    if (match === null || match.poolId !== pool._id) {
      throw new Error('No se ha encontrado el partido.')
    }

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const eligiblePlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const result = await ctx.db
      .query('matchResults')
      .withIndex('by_matchId', (q) => q.eq('matchId', match._id))
      .unique()
    const goals = await ctx.db
      .query('matchGoals')
      .withIndex('by_matchId_and_sortOrder', (q) => q.eq('matchId', match._id))
      .take(100)
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const expectedGoals = result === null ? 0 : result.homeGoals + result.awayGoals
    const recordedGoals = goals.length

    return {
      teams: serializeTeams(teams),
      eligiblePlayers: serializeActivePlayers(eligiblePlayers, teamsById, teamsByCode, teamsByName),
      matches: [
        {
          matchId: match._id,
          completeness:
            result !== null && expectedGoals !== recordedGoals
              ? {
                  expectedGoals,
                  recordedGoals,
                  missingGoals: Math.max(expectedGoals - recordedGoals, 0),
                  extraGoals: Math.max(recordedGoals - expectedGoals, 0),
                }
              : null,
        },
      ],
    }
  },
})

export const getGoalscorersAdminForHttp = internalQuery({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pool } = await requireAdminParticipant(ctx, args)
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const eligiblePlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)
    const topScorerConfirmations = await ctx.db
      .query('topScorerConfirmations')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_TOP_SCORER_CONFIRMATIONS)
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const playersById = new Map(eligiblePlayers.map((player) => [player._id, player]))

    return {
      eligiblePlayers: serializeActivePlayers(eligiblePlayers, teamsById, teamsByCode, teamsByName),
      topScorerConfirmations: serializeTopScorerConfirmations({
        topScorerConfirmations,
        playersById,
        teamsById,
        teamsByCode,
        teamsByName,
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

export const seedDeterministicTournamentResultsForAdmin = mutation({
  args: {
    scriptSecret: v.string(),
    slug: v.optional(v.string()),
    seed: v.optional(v.string()),
    confirmTopScorers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireAdminScriptSecret(args.scriptSecret)

    const seed = normalizeSeed(args.seed)
    const shouldConfirmTopScorers = args.confirmTopScorers ?? true
    const now = Date.now()
    const warnings: string[] = []
    const pool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
      .unique()

    if (pool === null) {
      throw new Error('No se ha encontrado la porra. Sincroniza participantes primero.')
    }

    const matches = await ctx.db
      .query('matches')
      .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', pool._id))
      .take(MAX_MATCHES)
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(200)
    const tiers = await ctx.db
      .query('teamTiers')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', pool._id))
      .take(25)
    const eligiblePlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_SEED_PLAYERS)
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_SEED_PARTICIPANTS)
    const existingResults = await ctx.db
      .query('matchResults')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(MAX_MATCHES)

    const tournamentMatches = matches
      .filter(isSeedTournamentMatch)
      .sort((left, right) => left.matchNumber - right.matchNumber)

    if (tournamentMatches.length === 0) {
      throw new Error('No hay partidos importados para sembrar resultados.')
    }

    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode.toUpperCase(), team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
    const existingResultsByMatchId = new Map(
      existingResults.map((result) => [result.matchId, result]),
    )
    const playerState = createSeedPlayerState(eligiblePlayers, teamsById, teamsByCode, teamsByName)
    const groupStatsByTeamId = initializeGroupStats(teams)
    const winnersByMatchNumber = new Map<number, Id<'teams'>>()
    const losersByMatchNumber = new Map<number, Id<'teams'>>()
    const usedThirdPlaceTeamIds = new Set<Id<'teams'>>()
    const generatedGoalsByPlayerId = new Map<Id<'eligiblePlayers'>, number>()
    let groupRankingContext: GroupRankingContext | null = null
    let matchTeamsUpdated = 0
    let resultsInserted = 0
    let resultsUpdated = 0
    let goalsDeleted = 0
    let goalsInserted = 0

    for (const match of tournamentMatches) {
      const groupStage = isGroupStage(match)

      if (!groupStage && groupRankingContext === null) {
        groupRankingContext = buildGroupRankingContext(groupStatsByTeamId, tiersById)
      }

      const homeTeam = resolveSeedMatchTeam({
        match,
        side: 'home',
        groupStage,
        groupRankingContext,
        teamsById,
        teamsByCode,
        teamsByName,
        winnersByMatchNumber,
        losersByMatchNumber,
        usedThirdPlaceTeamIds,
        warnings,
      })
      const awayTeam = resolveSeedMatchTeam({
        match,
        side: 'away',
        groupStage,
        groupRankingContext,
        teamsById,
        teamsByCode,
        teamsByName,
        winnersByMatchNumber,
        losersByMatchNumber,
        usedThirdPlaceTeamIds,
        warnings,
      })

      if (homeTeam._id === awayTeam._id) {
        throw new Error(`El partido ${match.matchNumber} tiene dos veces a ${homeTeam.name}.`)
      }

      if (match.homeTeamId !== homeTeam._id || match.awayTeamId !== awayTeam._id) {
        await ctx.db.patch(match._id, {
          homeTeamId: homeTeam._id,
          awayTeamId: awayTeam._id,
        })
        matchTeamsUpdated += 1
      }

      const result = generateSeededResult({
        seed,
        match,
        homeTeam,
        awayTeam,
        tiersById,
      })
      const existingResult = existingResultsByMatchId.get(match._id) ?? null
      const resultPayload = {
        poolId: pool._id,
        matchId: match._id,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        penaltyShootoutWinnerTeamId: result.penaltyShootoutWinnerTeamId,
        updatedAt: now,
        updatedByParticipantId: null,
      }

      if (existingResult === null) {
        await ctx.db.insert('matchResults', resultPayload)
        resultsInserted += 1
      } else {
        await ctx.db.patch(existingResult._id, resultPayload)
        resultsUpdated += 1
      }

      const existingGoals = await ctx.db
        .query('matchGoals')
        .withIndex('by_matchId_and_sortOrder', (q) => q.eq('matchId', match._id))
        .take(MAX_GOALS_PER_MATCH)

      if (existingGoals.length === MAX_GOALS_PER_MATCH) {
        addSeedWarning(
          warnings,
          `El partido ${match.matchNumber} tenía ${MAX_GOALS_PER_MATCH} goles existentes; solo se ha reemplazado ese lote acotado.`,
        )
      }

      for (const goal of existingGoals) {
        await ctx.db.delete(goal._id)
        goalsDeleted += 1
      }

      if (result.homeGoals + result.awayGoals > 0) {
        await ensureActiveSeedPlayersForTeam(ctx, {
          poolId: pool._id,
          team: homeTeam,
          state: playerState,
          now,
        })
        await ensureActiveSeedPlayersForTeam(ctx, {
          poolId: pool._id,
          team: awayTeam,
          state: playerState,
          now,
        })
      }

      const generatedGoals = generateSeededGoalsForMatch({
        seed,
        match,
        homeTeam,
        awayTeam,
        result,
        playersByTeamId: playerState.playersByTeamId,
      })

      for (const goal of generatedGoals) {
        await ctx.db.insert('matchGoals', {
          poolId: pool._id,
          matchId: match._id,
          scoringTeamId: goal.scoringTeamId,
          creditedPlayerId: goal.creditedPlayerId,
          isOwnGoal: goal.isOwnGoal,
          minuteLabel: goal.minuteLabel,
          sortOrder: goal.sortOrder,
          updatedAt: now,
          updatedByParticipantId: null,
        })
        goalsInserted += 1

        if (!goal.isOwnGoal) {
          addPoints(generatedGoalsByPlayerId, goal.creditedPlayerId, 1)
        }
      }

      if (groupStage) {
        updateGroupStats(groupStatsByTeamId, homeTeam, awayTeam, result)
      }

      if (result.winnerTeamId !== null) {
        winnersByMatchNumber.set(match.matchNumber, result.winnerTeamId)
      }

      if (result.loserTeamId !== null) {
        losersByMatchNumber.set(match.matchNumber, result.loserTeamId)
      }
    }

    const topScorers = getGeneratedTopScorers({
      goalsByPlayerId: generatedGoalsByPlayerId,
      playersById: playerState.playersById,
      teamsById,
      teamsByCode,
      teamsByName,
    })
    let topScorerConfirmationsDeleted = 0
    let topScorerConfirmationsInserted = 0

    if (shouldConfirmTopScorers) {
      const existingConfirmations = await ctx.db
        .query('topScorerConfirmations')
        .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
        .take(MAX_TOP_SCORER_CONFIRMATIONS)

      for (const confirmation of existingConfirmations) {
        await ctx.db.delete(confirmation._id)
        topScorerConfirmationsDeleted += 1
      }

      const confirmationParticipant =
        participants.find((participant) => participant.isAdmin) ?? participants[0] ?? null

      if (confirmationParticipant === null && topScorers.length > 0) {
        addSeedWarning(
          warnings,
          'Se han omitido las confirmaciones de máximos goleadores porque la porra no tiene participantes.',
        )
      }

      if (confirmationParticipant !== null) {
        for (const topScorer of topScorers) {
          await ctx.db.insert('topScorerConfirmations', {
            poolId: pool._id,
            eligiblePlayerId: topScorer.player._id,
            confirmedAt: now,
            confirmedByParticipantId: confirmationParticipant._id,
          })
          topScorerConfirmationsInserted += 1
        }
      }
    }

    const championTeamId = winnersByMatchNumber.get(104) ?? null
    const champion = championTeamId === null ? null : (teamsById.get(championTeamId) ?? null)

    return {
      poolId: pool._id,
      seed,
      matchesProcessed: tournamentMatches.length,
      matchTeamsUpdated,
      resultsInserted,
      resultsUpdated,
      goalsDeleted,
      goalsInserted,
      placeholderPlayersInserted: playerState.insertedPlaceholderPlayers,
      placeholderPlayersActivated: playerState.activatedPlaceholderPlayers,
      topScorerConfirmationsDeleted,
      topScorerConfirmationsInserted,
      champion:
        champion === null
          ? null
          : {
              teamId: champion._id,
              teamName: champion.name,
              teamFifaCode: champion.fifaCode,
            },
      topScorers: topScorers.map((topScorer) => ({
        eligiblePlayerId: topScorer.player._id,
        playerName: topScorer.player.name,
        teamName: topScorer.team?.name ?? topScorer.player.teamName,
        teamFifaCode: topScorer.team?.fifaCode ?? topScorer.player.teamFifaCode ?? '',
        goals: topScorer.goals,
      })),
      warnings,
    }
  },
})

function normalizeSeed(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : DEFAULT_TOURNAMENT_RESULT_SEED
}

function isSeedTournamentMatch(match: Doc<'matches'>) {
  return match.matchNumber >= 1 && match.matchNumber <= 104
}

function isGroupStage(match: Doc<'matches'>) {
  return match.stage === 'First Stage' || match.groupName !== null
}

function createSeedPlayerState(
  eligiblePlayers: Doc<'eligiblePlayers'>[],
  teamsById: Map<Id<'teams'>, Doc<'teams'>>,
  teamsByCode: Map<string, Doc<'teams'>>,
  teamsByName: Map<string, Doc<'teams'>>,
): SeedPlayerState {
  const playersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
  const playersByTeamId = new Map<Id<'teams'>, Doc<'eligiblePlayers'>[]>()
  const playersByTeamAndName = new Map<string, Doc<'eligiblePlayers'>>()

  for (const player of eligiblePlayers) {
    const team = resolvePlayerTeam(player, teamsById, teamsByCode, teamsByName)

    if (team === null) {
      continue
    }

    playersByTeamAndName.set(seedPlayerKey(team, player.name), player)

    if (!player.isActive) {
      continue
    }

    playersByTeamId.set(team._id, [...(playersByTeamId.get(team._id) ?? []), player])
  }

  for (const players of playersByTeamId.values()) {
    sortSeedPlayers(players)
  }

  return {
    playersById,
    playersByTeamId,
    playersByTeamAndName,
    insertedPlaceholderPlayers: 0,
    activatedPlaceholderPlayers: 0,
  }
}

async function ensureActiveSeedPlayersForTeam(
  ctx: MutationCtx,
  args: {
    poolId: Id<'pools'>
    team: Doc<'teams'>
    state: SeedPlayerState
    now: number
  },
) {
  const activePlayers = args.state.playersByTeamId.get(args.team._id) ?? []

  if (activePlayers.length > 0) {
    return activePlayers
  }

  const seededPlayers: Doc<'eligiblePlayers'>[] = []

  for (let index = 1; index <= 3; index += 1) {
    const name = `Jugador simulado ${args.team.fifaCode} ${index}`
    const key = seedPlayerKey(args.team, name)
    const existing = args.state.playersByTeamAndName.get(key)
    const payload = {
      poolId: args.poolId,
      name,
      teamName: args.team.name,
      teamId: args.team._id,
      teamFifaCode: args.team.fifaCode,
      isActive: true,
    }

    if (existing === undefined) {
      const playerId = await ctx.db.insert('eligiblePlayers', payload)
      const created = await ctx.db.get(playerId)

      if (created === null) {
        throw new Error('No se ha podido crear un goleador simulado.')
      }

      args.state.playersById.set(created._id, created)
      args.state.playersByTeamAndName.set(key, created)
      seededPlayers.push(created)
      args.state.insertedPlaceholderPlayers += 1
      continue
    }

    if (
      !existing.isActive ||
      existing.name !== payload.name ||
      existing.teamName !== payload.teamName ||
      existing.teamId !== payload.teamId ||
      existing.teamFifaCode !== payload.teamFifaCode
    ) {
      await ctx.db.patch(existing._id, {
        name: payload.name,
        teamName: payload.teamName,
        teamId: payload.teamId,
        teamFifaCode: payload.teamFifaCode,
        isActive: payload.isActive,
      })
    }

    const updated = await ctx.db.get(existing._id)

    if (updated === null) {
      throw new Error('No se ha podido activar un goleador simulado.')
    }

    if (!existing.isActive) {
      args.state.activatedPlaceholderPlayers += 1
    }

    args.state.playersById.set(updated._id, updated)
    args.state.playersByTeamAndName.set(key, updated)
    seededPlayers.push(updated)
  }

  sortSeedPlayers(seededPlayers)
  args.state.playersByTeamId.set(args.team._id, seededPlayers)

  return seededPlayers
}

function seedPlayerKey(team: Doc<'teams'>, playerName: string) {
  return `${team._id}:${normalizeKey(playerName)}`
}

function sortSeedPlayers(players: Doc<'eligiblePlayers'>[]) {
  players.sort((left, right) => left.name.localeCompare(right.name))
}

function initializeGroupStats(teams: Doc<'teams'>[]) {
  const statsByTeamId = new Map<Id<'teams'>, GroupStats>()

  for (const team of teams) {
    statsByTeamId.set(team._id, createEmptyGroupStats(team))
  }

  return statsByTeamId
}

function createEmptyGroupStats(team: Doc<'teams'>): GroupStats {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  }
}

function updateGroupStats(
  statsByTeamId: Map<Id<'teams'>, GroupStats>,
  homeTeam: Doc<'teams'>,
  awayTeam: Doc<'teams'>,
  result: GeneratedResult,
) {
  const homeStats = getOrCreateGroupStats(statsByTeamId, homeTeam)
  const awayStats = getOrCreateGroupStats(statsByTeamId, awayTeam)

  homeStats.played += 1
  awayStats.played += 1
  homeStats.goalsFor += result.homeGoals
  homeStats.goalsAgainst += result.awayGoals
  awayStats.goalsFor += result.awayGoals
  awayStats.goalsAgainst += result.homeGoals

  if (result.homeGoals > result.awayGoals) {
    homeStats.wins += 1
    homeStats.points += 3
    awayStats.losses += 1
    return
  }

  if (result.awayGoals > result.homeGoals) {
    awayStats.wins += 1
    awayStats.points += 3
    homeStats.losses += 1
    return
  }

  homeStats.draws += 1
  homeStats.points += 1
  awayStats.draws += 1
  awayStats.points += 1
}

function getOrCreateGroupStats(statsByTeamId: Map<Id<'teams'>, GroupStats>, team: Doc<'teams'>) {
  const existing = statsByTeamId.get(team._id)

  if (existing !== undefined) {
    return existing
  }

  const created = createEmptyGroupStats(team)
  statsByTeamId.set(team._id, created)
  return created
}

function buildGroupRankingContext(
  statsByTeamId: Map<Id<'teams'>, GroupStats>,
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>,
): GroupRankingContext {
  const rankingsByGroup = new Map<string, GroupStats[]>()

  for (const stats of statsByTeamId.values()) {
    const groupCode = getTeamGroupCode(stats.team)

    if (groupCode === '') {
      continue
    }

    rankingsByGroup.set(groupCode, [...(rankingsByGroup.get(groupCode) ?? []), stats])
  }

  for (const ranking of rankingsByGroup.values()) {
    ranking.sort((left, right) => compareGroupStats(left, right, tiersById))
  }

  const thirdPlaceCandidates = [...rankingsByGroup.values()]
    .map((ranking) => ranking[2] ?? null)
    .filter(isPresent)
    .sort((left, right) => compareGroupStats(left, right, tiersById))

  return {
    rankingsByGroup,
    thirdPlaceCandidates,
  }
}

function resolveSeedMatchTeam(args: {
  match: Doc<'matches'>
  side: 'home' | 'away'
  groupStage: boolean
  groupRankingContext: GroupRankingContext | null
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
  winnersByMatchNumber: Map<number, Id<'teams'>>
  losersByMatchNumber: Map<number, Id<'teams'>>
  usedThirdPlaceTeamIds: Set<Id<'teams'>>
  warnings: string[]
}) {
  const teamId = args.side === 'home' ? args.match.homeTeamId : args.match.awayTeamId
  const placeholder = args.side === 'home' ? args.match.homePlaceholder : args.match.awayPlaceholder

  if (args.groupStage && teamId !== null) {
    const team = args.teamsById.get(teamId)

    if (team === undefined) {
      throw new Error(`El partido ${args.match.matchNumber} tiene una selección no válida.`)
    }

    return team
  }

  const normalizedPlaceholder = normalizeMatchPlaceholder(placeholder)
  const winnerMatch = normalizedPlaceholder.match(/^W(\d+)$/)

  if (winnerMatch !== null) {
    return resolveReferencedSeedTeam({
      matchNumber: Number(winnerMatch[1]),
      source: 'winner',
      referencedTeamsByMatchNumber: args.winnersByMatchNumber,
      teamsById: args.teamsById,
      currentMatchNumber: args.match.matchNumber,
    })
  }

  const runnerUpMatch = normalizedPlaceholder.match(/^(?:RU|L)(\d+)$/)

  if (runnerUpMatch !== null) {
    return resolveReferencedSeedTeam({
      matchNumber: Number(runnerUpMatch[1]),
      source: 'runner-up',
      referencedTeamsByMatchNumber: args.losersByMatchNumber,
      teamsById: args.teamsById,
      currentMatchNumber: args.match.matchNumber,
    })
  }

  const exactGroupPosition = normalizedPlaceholder.match(/^([12])([A-L])$/)

  if (exactGroupPosition !== null) {
    return resolveGroupPositionSeedTeam({
      rankingContext: args.groupRankingContext,
      groupCode: exactGroupPosition[2],
      position: Number(exactGroupPosition[1]),
      matchNumber: args.match.matchNumber,
    })
  }

  const thirdPlacePosition = normalizedPlaceholder.match(/^3([A-L]+)$/)

  if (thirdPlacePosition !== null) {
    return resolveThirdPlaceSeedTeam({
      rankingContext: args.groupRankingContext,
      allowedGroups: thirdPlacePosition[1].split(''),
      usedThirdPlaceTeamIds: args.usedThirdPlaceTeamIds,
      matchNumber: args.match.matchNumber,
      warnings: args.warnings,
    })
  }

  const teamByCode = args.teamsByCode.get(normalizedPlaceholder)

  if (teamByCode !== undefined) {
    return teamByCode
  }

  const teamByName = resolveTeamByName(args.teamsByName, placeholder)

  if (teamByName !== null) {
    return teamByName
  }

  if (teamId !== null) {
    const existingTeam = args.teamsById.get(teamId)

    if (existingTeam !== undefined) {
      addSeedWarning(
        args.warnings,
        `El partido ${args.match.matchNumber} ha reutilizado una selección ya resuelta para "${placeholder}".`,
      )
      return existingTeam
    }
  }

  throw new Error(
    `No se ha podido resolver ${placeholder} en el partido ${args.match.matchNumber}.`,
  )
}

function resolveReferencedSeedTeam(args: {
  matchNumber: number
  source: 'winner' | 'runner-up'
  referencedTeamsByMatchNumber: Map<number, Id<'teams'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  currentMatchNumber: number
}) {
  const teamId = args.referencedTeamsByMatchNumber.get(args.matchNumber)

  if (teamId === undefined) {
    throw new Error(
      `No se ha podido resolver el ${args.source} del partido ${args.matchNumber} para el partido ${args.currentMatchNumber}.`,
    )
  }

  const team = args.teamsById.get(teamId)

  if (team === undefined) {
    throw new Error(`El partido ${args.matchNumber} referencia una selección no válida.`)
  }

  return team
}

function resolveGroupPositionSeedTeam(args: {
  rankingContext: GroupRankingContext | null
  groupCode: string
  position: number
  matchNumber: number
}) {
  const ranking = args.rankingContext?.rankingsByGroup.get(args.groupCode)
  const stats = ranking?.[args.position - 1]

  if (stats === undefined) {
    throw new Error(
      `No se ha podido resolver ${args.position}${args.groupCode} en el partido ${args.matchNumber}.`,
    )
  }

  return stats.team
}

function resolveThirdPlaceSeedTeam(args: {
  rankingContext: GroupRankingContext | null
  allowedGroups: string[]
  usedThirdPlaceTeamIds: Set<Id<'teams'>>
  matchNumber: number
  warnings: string[]
}) {
  const rankingContext = args.rankingContext

  if (rankingContext === null) {
    throw new Error(
      `No se han podido resolver terceros puestos para el partido ${args.matchNumber}.`,
    )
  }

  const allowedGroups = new Set(args.allowedGroups)
  const qualifiedThirds = rankingContext.thirdPlaceCandidates.slice(0, THIRD_PLACE_QUALIFIERS)
  const candidate =
    qualifiedThirds.find(
      (stats) =>
        allowedGroups.has(getTeamGroupCode(stats.team)) &&
        !args.usedThirdPlaceTeamIds.has(stats.team._id),
    ) ??
    qualifiedThirds.find((stats) => !args.usedThirdPlaceTeamIds.has(stats.team._id)) ??
    rankingContext.thirdPlaceCandidates.find(
      (stats) => !args.usedThirdPlaceTeamIds.has(stats.team._id),
    ) ??
    null

  if (candidate === null) {
    throw new Error(`No quedan terceros puestos disponibles para el partido ${args.matchNumber}.`)
  }

  if (!allowedGroups.has(getTeamGroupCode(candidate.team))) {
    addSeedWarning(
      args.warnings,
      `El partido ${args.matchNumber} ha usado ${candidate.team.fifaCode} como tercer puesto determinista fuera de ${args.allowedGroups.join('')}.`,
    )
  }

  args.usedThirdPlaceTeamIds.add(candidate.team._id)
  return candidate.team
}

function resolveTeamByName(teamsByName: Map<string, Doc<'teams'>>, name: string) {
  const direct = teamsByName.get(name.trim())

  if (direct !== undefined) {
    return direct
  }

  const normalized = normalizeKey(name)

  for (const team of teamsByName.values()) {
    if (normalizeKey(team.name) === normalized) {
      return team
    }
  }

  return null
}

function normalizeMatchPlaceholder(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function generateSeededResult(args: {
  seed: string
  match: Doc<'matches'>
  homeTeam: Doc<'teams'>
  awayTeam: Doc<'teams'>
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
}): GeneratedResult {
  const rng = createSeededRng(`${args.seed}:result:${args.match.matchNumber}`)
  const strengthEdge = clamp(
    (getTeamStrength(args.homeTeam, args.tiersById) -
      getTeamStrength(args.awayTeam, args.tiersById)) *
      0.16,
    -0.22,
    0.22,
  )
  const groupStage = isGroupStage(args.match)
  const drawProbability = groupStage
    ? clamp(0.26 - Math.abs(strengthEdge) * 0.25, 0.16, 0.3)
    : clamp(0.22 - Math.abs(strengthEdge) * 0.18, 0.12, 0.24)

  if (rng() < drawProbability) {
    const drawGoals = drawDrawGoals(rng, groupStage)
    const penaltyShootoutWinnerTeamId = groupStage
      ? null
      : rng() < clamp(0.5 + strengthEdge, 0.25, 0.75)
        ? args.homeTeam._id
        : args.awayTeam._id

    return buildGeneratedResult(
      args.homeTeam,
      args.awayTeam,
      drawGoals,
      drawGoals,
      penaltyShootoutWinnerTeamId,
    )
  }

  const homeWins = rng() < clamp(0.5 + strengthEdge, 0.24, 0.76)
  const winnerGoals = drawWinnerGoals(rng)
  const loserGoals = drawLoserGoals(rng, winnerGoals)

  return buildGeneratedResult(
    args.homeTeam,
    args.awayTeam,
    homeWins ? winnerGoals : loserGoals,
    homeWins ? loserGoals : winnerGoals,
    null,
  )
}

function buildGeneratedResult(
  homeTeam: Doc<'teams'>,
  awayTeam: Doc<'teams'>,
  homeGoals: number,
  awayGoals: number,
  penaltyShootoutWinnerTeamId: Id<'teams'> | null,
): GeneratedResult {
  if (homeGoals > awayGoals) {
    return {
      homeGoals,
      awayGoals,
      penaltyShootoutWinnerTeamId: null,
      winnerTeamId: homeTeam._id,
      loserTeamId: awayTeam._id,
    }
  }

  if (awayGoals > homeGoals) {
    return {
      homeGoals,
      awayGoals,
      penaltyShootoutWinnerTeamId: null,
      winnerTeamId: awayTeam._id,
      loserTeamId: homeTeam._id,
    }
  }

  if (penaltyShootoutWinnerTeamId === homeTeam._id) {
    return {
      homeGoals,
      awayGoals,
      penaltyShootoutWinnerTeamId,
      winnerTeamId: homeTeam._id,
      loserTeamId: awayTeam._id,
    }
  }

  if (penaltyShootoutWinnerTeamId === awayTeam._id) {
    return {
      homeGoals,
      awayGoals,
      penaltyShootoutWinnerTeamId,
      winnerTeamId: awayTeam._id,
      loserTeamId: homeTeam._id,
    }
  }

  return {
    homeGoals,
    awayGoals,
    penaltyShootoutWinnerTeamId: null,
    winnerTeamId: null,
    loserTeamId: null,
  }
}

function drawDrawGoals(rng: () => number, groupStage: boolean) {
  const roll = rng()

  if (groupStage && roll < 0.22) {
    return 0
  }

  if (roll < 0.62) {
    return 1
  }

  if (roll < 0.88) {
    return 2
  }

  return 3
}

function drawWinnerGoals(rng: () => number) {
  const roll = rng()

  if (roll < 0.28) {
    return 1
  }

  if (roll < 0.68) {
    return 2
  }

  if (roll < 0.9) {
    return 3
  }

  if (roll < 0.98) {
    return 4
  }

  return 5
}

function drawLoserGoals(rng: () => number, winnerGoals: number) {
  if (winnerGoals <= 1) {
    return 0
  }

  const weighted = rng() < 0.58 ? 0 : rng() < 0.86 ? 1 : 2
  return Math.min(weighted, winnerGoals - 1)
}

function generateSeededGoalsForMatch(args: {
  seed: string
  match: Doc<'matches'>
  homeTeam: Doc<'teams'>
  awayTeam: Doc<'teams'>
  result: GeneratedResult
  playersByTeamId: Map<Id<'teams'>, Doc<'eligiblePlayers'>[]>
}): GeneratedGoal[] {
  const rng = createSeededRng(`${args.seed}:goals:${args.match.matchNumber}`)
  const goals: Array<GeneratedGoal & { minute: number }> = []

  for (let index = 0; index < args.result.homeGoals; index += 1) {
    goals.push(
      generateSeededGoalEvent({
        rng,
        groupStage: isGroupStage(args.match),
        scoringTeam: args.homeTeam,
        opponentTeam: args.awayTeam,
        playersByTeamId: args.playersByTeamId,
      }),
    )
  }

  for (let index = 0; index < args.result.awayGoals; index += 1) {
    goals.push(
      generateSeededGoalEvent({
        rng,
        groupStage: isGroupStage(args.match),
        scoringTeam: args.awayTeam,
        opponentTeam: args.homeTeam,
        playersByTeamId: args.playersByTeamId,
      }),
    )
  }

  return goals
    .sort(
      (left, right) =>
        left.minute - right.minute ||
        String(left.scoringTeamId).localeCompare(String(right.scoringTeamId)),
    )
    .map((goal, index) => ({
      scoringTeamId: goal.scoringTeamId,
      creditedPlayerId: goal.creditedPlayerId,
      isOwnGoal: goal.isOwnGoal,
      minuteLabel: formatMinuteLabel(goal.minute),
      sortOrder: index,
    }))
}

function generateSeededGoalEvent(args: {
  rng: () => number
  groupStage: boolean
  scoringTeam: Doc<'teams'>
  opponentTeam: Doc<'teams'>
  playersByTeamId: Map<Id<'teams'>, Doc<'eligiblePlayers'>[]>
}): GeneratedGoal & { minute: number } {
  const scoringPlayers = args.playersByTeamId.get(args.scoringTeam._id) ?? []
  const opponentPlayers = args.playersByTeamId.get(args.opponentTeam._id) ?? []
  const isOwnGoal = opponentPlayers.length > 0 && (scoringPlayers.length === 0 || args.rng() < 0.06)
  const creditedPlayers = isOwnGoal ? opponentPlayers : scoringPlayers
  const creditedPlayer = pickSeedGoalPlayer(creditedPlayers, args.rng)

  return {
    scoringTeamId: args.scoringTeam._id,
    creditedPlayerId: creditedPlayer._id,
    isOwnGoal,
    minuteLabel: '',
    sortOrder: 0,
    minute: drawGoalMinute(args.rng, args.groupStage),
  }
}

function pickSeedGoalPlayer(players: Doc<'eligiblePlayers'>[], rng: () => number) {
  if (players.length === 0) {
    throw new Error('No hay goleadores elegibles para generar los goles del partido.')
  }

  const candidates = players.slice(0, Math.min(players.length, 8))
  const totalWeight = candidates.reduce((total, _player, index) => {
    return total + (candidates.length - index)
  }, 0)
  let roll = rng() * totalWeight

  for (const [index, player] of candidates.entries()) {
    roll -= candidates.length - index

    if (roll <= 0) {
      return player
    }
  }

  return candidates[candidates.length - 1]
}

function drawGoalMinute(rng: () => number, groupStage: boolean) {
  const maxMinute = groupStage ? 90 : 120
  return 1 + Math.floor(rng() * maxMinute)
}

function formatMinuteLabel(minute: number) {
  return `${minute}'`
}

function getGeneratedTopScorers(args: {
  goalsByPlayerId: Map<Id<'eligiblePlayers'>, number>
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
}) {
  const topScorerRows: GeneratedTopScorer[] = Array.from(args.goalsByPlayerId.entries())
    .map(([playerId, goals]) => {
      const player = args.playersById.get(playerId)

      if (player === undefined) {
        return null
      }

      return {
        player,
        team: resolvePlayerTeam(player, args.teamsById, args.teamsByCode, args.teamsByName),
        goals,
      }
    })
    .filter(isPresent)
    .sort(
      (left, right) =>
        right.goals - left.goals || left.player.name.localeCompare(right.player.name),
    )
  const topGoalCount = topScorerRows[0]?.goals ?? 0

  if (topGoalCount <= 0) {
    return []
  }

  return topScorerRows
    .filter((topScorer) => topScorer.goals === topGoalCount)
    .slice(0, MAX_TOP_SCORER_CONFIRMATIONS)
}

function compareGroupStats(
  left: GroupStats,
  right: GroupStats,
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>,
) {
  return (
    right.points - left.points ||
    getGoalDifference(right) - getGoalDifference(left) ||
    right.goalsFor - left.goalsFor ||
    right.wins - left.wins ||
    getTeamStrength(right.team, tiersById) - getTeamStrength(left.team, tiersById) ||
    left.team.fifaCode.localeCompare(right.team.fifaCode)
  )
}

function getGoalDifference(stats: GroupStats) {
  return stats.goalsFor - stats.goalsAgainst
}

function getTeamGroupCode(team: Doc<'teams'>) {
  return team.groupCode?.trim().toUpperCase() ?? ''
}

function getTeamStrength(team: Doc<'teams'>, tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>) {
  const tier = tiersById.get(team.tierId)
  const tierScore = tier === undefined ? 1 : Math.max(0, 5 - tier.sortOrder) * 0.5
  const codeJitter = hashString(team.fifaCode) / 0xffffffff - 0.5

  return tierScore + codeJitter * 0.2
}

function createSeededRng(seed: string) {
  let state = hashString(seed) || 1

  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function addPoints<TKey>(pointsByKey: Map<TKey, number>, key: TKey, points: number) {
  pointsByKey.set(key, (pointsByKey.get(key) ?? 0) + points)
}

function addSeedWarning(warnings: string[], warning: string) {
  if (warnings.length < MAX_SEED_WARNINGS) {
    warnings.push(warning)
  }
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

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
  ctx: QueryCtx | MutationCtx,
  args: {
    poolId: Id<'pools'>
    participantId: Id<'participants'>
    slug?: string
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

function serializeTeams(teams: Doc<'teams'>[]) {
  return teams
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((team) => ({
      id: team._id,
      name: team.name,
      fifaCode: team.fifaCode,
      groupCode: team.groupCode ?? '?',
    }))
}

function serializeActivePlayers(
  eligiblePlayers: Doc<'eligiblePlayers'>[],
  teamsById: Map<Id<'teams'>, Doc<'teams'>>,
  teamsByCode: Map<string, Doc<'teams'>>,
  teamsByName: Map<string, Doc<'teams'>>,
) {
  return eligiblePlayers
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
    })
}

function buildGoalscorerLeaderboard({
  goals,
  playersById,
  teamsById,
  teamsByCode,
  teamsByName,
  confirmedTopScorerIds,
}: {
  goals: Doc<'matchGoals'>[]
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
  confirmedTopScorerIds: Set<Id<'eligiblePlayers'>>
}) {
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

  return Array.from(goalsByPlayerId.entries())
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
      (left, right) => right.goals - left.goals || left.playerName.localeCompare(right.playerName),
    )
}

function serializeTopScorerConfirmations({
  topScorerConfirmations,
  playersById,
  teamsById,
  teamsByCode,
  teamsByName,
}: {
  topScorerConfirmations: Doc<'topScorerConfirmations'>[]
  playersById: Map<Id<'eligiblePlayers'>, Doc<'eligiblePlayers'>>
  teamsById: Map<Id<'teams'>, Doc<'teams'>>
  teamsByCode: Map<string, Doc<'teams'>>
  teamsByName: Map<string, Doc<'teams'>>
}) {
  return topScorerConfirmations
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
    .sort((left, right) => left.playerName.localeCompare(right.playerName))
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
