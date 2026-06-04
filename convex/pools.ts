import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { requireAdminScriptSecret } from './adminScriptAuth'
import { hashPin, verifyPin } from './authCrypto'
import { stageBonusSeed } from './scoringRules'

const DEMO_SLUG = 'world-cup-2026'
const DEFAULT_ENTRY_LOCK_AT = Date.UTC(2026, 5, 11, 19, 0, 0)

type EntryOverview = {
  entryId: Id<'entries'> | null
  participantId: Id<'participants'>
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
}

type LeaderboardScore = {
  entryId: Id<'entries'>
  participantId: Id<'participants'>
  currentScore: number
}

type EligiblePlayerImport = {
  name: string
  teamFifaCode: string
}

const teamSeed = [
  { name: 'México', fifaCode: 'MEX', groupCode: 'A', tierOrder: 1 },
  { name: 'Sudáfrica', fifaCode: 'RSA', groupCode: 'A', tierOrder: 3 },
  { name: 'Corea del Sur', fifaCode: 'KOR', groupCode: 'A', tierOrder: 2 },
  { name: 'Chequia', fifaCode: 'CZE', groupCode: 'A', tierOrder: 4 },
  { name: 'Canadá', fifaCode: 'CAN', groupCode: 'B', tierOrder: 1 },
  { name: 'Suiza', fifaCode: 'SUI', groupCode: 'B', tierOrder: 2 },
  { name: 'Catar', fifaCode: 'QAT', groupCode: 'B', tierOrder: 3 },
  { name: 'Bosnia y Herzegovina', fifaCode: 'BIH', groupCode: 'B', tierOrder: 4 },
  { name: 'Brasil', fifaCode: 'BRA', groupCode: 'C', tierOrder: 1 },
  { name: 'Marruecos', fifaCode: 'MAR', groupCode: 'C', tierOrder: 2 },
  { name: 'Haití', fifaCode: 'HAI', groupCode: 'C', tierOrder: 3 },
  { name: 'Escocia', fifaCode: 'SCO', groupCode: 'C', tierOrder: 4 },
  { name: 'Estados Unidos', fifaCode: 'USA', groupCode: 'D', tierOrder: 1 },
  { name: 'Paraguay', fifaCode: 'PAR', groupCode: 'D', tierOrder: 2 },
  { name: 'Australia', fifaCode: 'AUS', groupCode: 'D', tierOrder: 3 },
  { name: 'Turquía', fifaCode: 'TUR', groupCode: 'D', tierOrder: 4 },
  { name: 'Alemania', fifaCode: 'GER', groupCode: 'E', tierOrder: 1 },
  { name: 'Curazao', fifaCode: 'CUW', groupCode: 'E', tierOrder: 4 },
  { name: 'Costa de Marfil', fifaCode: 'CIV', groupCode: 'E', tierOrder: 3 },
  { name: 'Ecuador', fifaCode: 'ECU', groupCode: 'E', tierOrder: 2 },
  { name: 'Países Bajos', fifaCode: 'NED', groupCode: 'F', tierOrder: 1 },
  { name: 'Japón', fifaCode: 'JPN', groupCode: 'F', tierOrder: 2 },
  { name: 'Túnez', fifaCode: 'TUN', groupCode: 'F', tierOrder: 3 },
  { name: 'Suecia', fifaCode: 'SWE', groupCode: 'F', tierOrder: 4 },
  { name: 'Bélgica', fifaCode: 'BEL', groupCode: 'G', tierOrder: 1 },
  { name: 'Egipto', fifaCode: 'EGY', groupCode: 'G', tierOrder: 2 },
  { name: 'Irán', fifaCode: 'IRN', groupCode: 'G', tierOrder: 3 },
  { name: 'Nueva Zelanda', fifaCode: 'NZL', groupCode: 'G', tierOrder: 4 },
  { name: 'España', fifaCode: 'ESP', groupCode: 'H', tierOrder: 1 },
  { name: 'Cabo Verde', fifaCode: 'CPV', groupCode: 'H', tierOrder: 4 },
  { name: 'Arabia Saudí', fifaCode: 'KSA', groupCode: 'H', tierOrder: 3 },
  { name: 'Uruguay', fifaCode: 'URU', groupCode: 'H', tierOrder: 2 },
  { name: 'Francia', fifaCode: 'FRA', groupCode: 'I', tierOrder: 1 },
  { name: 'Senegal', fifaCode: 'SEN', groupCode: 'I', tierOrder: 2 },
  { name: 'Irak', fifaCode: 'IRQ', groupCode: 'I', tierOrder: 4 },
  { name: 'Noruega', fifaCode: 'NOR', groupCode: 'I', tierOrder: 3 },
  { name: 'Argentina', fifaCode: 'ARG', groupCode: 'J', tierOrder: 1 },
  { name: 'Argelia', fifaCode: 'ALG', groupCode: 'J', tierOrder: 2 },
  { name: 'Austria', fifaCode: 'AUT', groupCode: 'J', tierOrder: 3 },
  { name: 'Jordania', fifaCode: 'JOR', groupCode: 'J', tierOrder: 4 },
  { name: 'Portugal', fifaCode: 'POR', groupCode: 'K', tierOrder: 1 },
  { name: 'Uzbekistán', fifaCode: 'UZB', groupCode: 'K', tierOrder: 3 },
  { name: 'Colombia', fifaCode: 'COL', groupCode: 'K', tierOrder: 2 },
  { name: 'RD Congo', fifaCode: 'COD', groupCode: 'K', tierOrder: 4 },
  { name: 'Inglaterra', fifaCode: 'ENG', groupCode: 'L', tierOrder: 1 },
  { name: 'Croacia', fifaCode: 'CRO', groupCode: 'L', tierOrder: 2 },
  { name: 'Ghana', fifaCode: 'GHA', groupCode: 'L', tierOrder: 3 },
  { name: 'Panamá', fifaCode: 'PAN', groupCode: 'L', tierOrder: 4 },
]

const tierSeed = [
  { name: 'Bombo 1', requiredPicks: 1, multiplier: 1, sortOrder: 1 },
  { name: 'Bombo 2', requiredPicks: 2, multiplier: 1.25, sortOrder: 2 },
  { name: 'Bombo 3', requiredPicks: 2, multiplier: 1.5, sortOrder: 3 },
  { name: 'Bombo 4', requiredPicks: 2, multiplier: 1.75, sortOrder: 4 },
]

type PreviewMatchSeed = {
  matchNumber: number
  offsetMs: number
  stage: string
  groupName: string | null
  venueName: string
  venueCity: string
  homeTeamFifaCode: string
  awayTeamFifaCode: string
  result?: {
    homeGoals: number
    awayGoals: number
    goals: Array<{
      scoringTeamFifaCode: string
      creditedTeamFifaCode: string
      playerPreviewIndex: number
      minuteLabel: string
      isOwnGoal?: boolean
    }>
  }
}

const previewMatchSeed: PreviewMatchSeed[] = [
  {
    matchNumber: 1001,
    offsetMs: -24 * 60 * 60 * 1000,
    stage: 'First Stage',
    groupName: 'Grupo Preview A',
    venueName: 'Estadio Inventado del Atlántico',
    venueCity: 'Ciudad Preview',
    homeTeamFifaCode: 'ESP',
    awayTeamFifaCode: 'MEX',
    result: {
      homeGoals: 2,
      awayGoals: 1,
      goals: [
        {
          scoringTeamFifaCode: 'ESP',
          creditedTeamFifaCode: 'ESP',
          playerPreviewIndex: 1,
          minuteLabel: "18'",
        },
        {
          scoringTeamFifaCode: 'MEX',
          creditedTeamFifaCode: 'MEX',
          playerPreviewIndex: 2,
          minuteLabel: "54'",
        },
        {
          scoringTeamFifaCode: 'ESP',
          creditedTeamFifaCode: 'ESP',
          playerPreviewIndex: 3,
          minuteLabel: "82'",
        },
      ],
    },
  },
  {
    matchNumber: 1002,
    offsetMs: -30 * 60 * 1000,
    stage: 'First Stage',
    groupName: 'Grupo Preview B',
    venueName: 'Arena del Sol Preview',
    venueCity: 'Villa Demo',
    homeTeamFifaCode: 'BRA',
    awayTeamFifaCode: 'JPN',
    result: {
      homeGoals: 1,
      awayGoals: 1,
      goals: [
        {
          scoringTeamFifaCode: 'BRA',
          creditedTeamFifaCode: 'BRA',
          playerPreviewIndex: 1,
          minuteLabel: "37'",
        },
        {
          scoringTeamFifaCode: 'JPN',
          creditedTeamFifaCode: 'JPN',
          playerPreviewIndex: 1,
          minuteLabel: "74'",
        },
      ],
    },
  },
  {
    matchNumber: 1003,
    offsetMs: 90 * 60 * 1000,
    stage: 'First Stage',
    groupName: 'Grupo Preview C',
    venueName: 'Campo Norte de Pruebas',
    venueCity: 'Puerto Fixture',
    homeTeamFifaCode: 'ARG',
    awayTeamFifaCode: 'MAR',
  },
  {
    matchNumber: 1004,
    offsetMs: 8 * 60 * 60 * 1000,
    stage: 'First Stage',
    groupName: 'Grupo Preview D',
    venueName: 'Estadio de la Maqueta',
    venueCity: 'Bahía Mockup',
    homeTeamFifaCode: 'FRA',
    awayTeamFifaCode: 'SEN',
  },
  {
    matchNumber: 1005,
    offsetMs: 28 * 60 * 60 * 1000,
    stage: 'Round of 32',
    groupName: null,
    venueName: 'Parque Bracket Preview',
    venueCity: 'Nueva Prueba',
    homeTeamFifaCode: 'ENG',
    awayTeamFifaCode: 'URU',
  },
  {
    matchNumber: 1006,
    offsetMs: 4 * 24 * 60 * 60 * 1000,
    stage: 'Quarter-final',
    groupName: null,
    venueName: 'Coliseo Ficticio',
    venueCity: 'Costa Demo',
    homeTeamFifaCode: 'POR',
    awayTeamFifaCode: 'GER',
  },
]

export const getAuthenticatedOverview = internalQuery({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
      .unique()

    if (pool === null || pool._id !== args.poolId) {
      return null
    }

    const sessionParticipant = await ctx.db.get(args.participantId)

    if (sessionParticipant === null || sessionParticipant.poolId !== pool._id) {
      return null
    }

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
      .take(1500)
    const stageBonuses = await ctx.db
      .query('stageBonuses')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', pool._id))
      .take(25)
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

    const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const teamsByName = new Map(teams.map((team) => [team.name, team]))
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode, team]))
    const eligiblePlayersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
    const entriesByParticipantId = new Map(entries.map((entry) => [entry.participantId, entry]))
    const leaderboardScores: LeaderboardScore[] = await ctx.runQuery(
      internal.scoring.getLeaderboardScoresForPool,
      { poolId: pool._id },
    )
    const scoresByEntryId = new Map(
      leaderboardScores.map((score) => [score.entryId, score.currentScore]),
    )
    const picksByEntryId = new Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>()
    const goalscorerPicksByEntryId = new Map<Id<'entries'>, Doc<'entryGoalscorerPicks'>[]>()

    for (const pick of entryTeamPicks) {
      const existing = picksByEntryId.get(pick.entryId) ?? []
      existing.push(pick)
      picksByEntryId.set(pick.entryId, existing)
    }

    for (const pick of entryGoalscorerPicks) {
      const existing = goalscorerPicksByEntryId.get(pick.entryId) ?? []
      existing.push(pick)
      goalscorerPicksByEntryId.set(pick.entryId, existing)
    }

    const entryOverviews: EntryOverview[] = participants.map((participant) => {
      const entry = entriesByParticipantId.get(participant._id) ?? null
      const goalscorerPicks = (
        entry === null ? [] : (goalscorerPicksByEntryId.get(entry._id) ?? [])
      )
        .map((pick) => {
          const tier = tiersById.get(pick.tierId)
          const player = eligiblePlayersById.get(pick.eligiblePlayerId)

          return {
            tierName: tier?.name ?? 'Unknown tier',
            playerName: player?.name ?? 'Unknown player',
            teamName: player?.teamName ?? 'Unknown team',
            sortOrder: tier?.sortOrder ?? 999,
          }
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.playerName.localeCompare(right.playerName),
        )
        .map(({ tierName, playerName, teamName }) => ({ tierName, playerName, teamName }))
      const teamPicks = (entry === null ? [] : (picksByEntryId.get(entry._id) ?? []))
        .map((pick) => {
          const tier = tiersById.get(pick.tierId)
          const team = teamsById.get(pick.teamId)

          return {
            tierName: tier?.name ?? 'Unknown tier',
            teamName: team?.name ?? 'Unknown team',
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
    })
    const currentEntry =
      entries.find((entry) => entry.participantId === sessionParticipant._id) ?? null

    return {
      session: {
        participantId: sessionParticipant._id,
        participantName: sessionParticipant.displayName,
        isAdmin: sessionParticipant.isAdmin,
      },
      pool: {
        name: pool.name,
        slug: pool.slug,
        entryLockAt: pool.entryLockAt,
        status: pool.status,
      },
      counts: {
        participants: participants.length,
        teamTiers: tiers.length,
        teams: teams.length,
        eligiblePlayers: eligiblePlayers.length,
        entries: entries.length,
      },
      teamTiers: tiers.map((tier) => ({
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
      })),
      eligiblePlayers: eligiblePlayers
        .filter((player) => player.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((player) => ({
          ...getEligiblePlayerTeamFields(player, teamsById, teamsByName, teamsByCode),
          id: player._id,
          name: player.name,
        })),
      stageBonuses: stageBonuses.map((bonus) => ({
        id: bonus._id,
        stage: bonus.stage,
        points: bonus.points,
      })),
      leaderboard: entryOverviews.sort(
        (left, right) =>
          Number(right.entryId !== null) - Number(left.entryId !== null) ||
          right.currentScore - left.currentScore ||
          left.participantName.localeCompare(right.participantName),
      ),
      currentEntry:
        currentEntry === null
          ? null
          : {
              teamPickIds: (picksByEntryId.get(currentEntry._id) ?? []).map((pick) => pick.teamId),
              goalscorerPickIds: (goalscorerPicksByEntryId.get(currentEntry._id) ?? []).map(
                (pick) => ({
                  tierId: pick.tierId,
                  eligiblePlayerId: pick.eligiblePlayerId,
                }),
              ),
            },
    }
  },
})

export const saveEntryForHttp = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    teamPickIds: v.array(v.id('teams')),
    goalscorerPickIds: v.array(
      v.object({
        tierId: v.id('teamTiers'),
        eligiblePlayerId: v.id('eligiblePlayers'),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const pool = await ctx.db.get(args.poolId)
    const participant = await ctx.db.get(args.participantId)

    if (pool === null || participant === null || participant.poolId !== pool._id) {
      throw new Error('No autorizado.')
    }

    if (pool.status !== 'open' || pool.entryLockAt <= Date.now()) {
      throw new Error('La entrada ya esta cerrada.')
    }

    const tiers = await ctx.db
      .query('teamTiers')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', pool._id))
      .take(25)
    const teams = await Promise.all(
      args.teamPickIds.map(async (teamId) => await ctx.db.get(teamId)),
    )
    const goalscorerPicks = await Promise.all(
      args.goalscorerPickIds.map(async (pick) => ({
        tierId: pick.tierId,
        player: await ctx.db.get(pick.eligiblePlayerId),
      })),
    )

    if (new Set(args.teamPickIds).size !== args.teamPickIds.length) {
      throw new Error('No puedes elegir el mismo equipo dos veces.')
    }

    for (const team of teams) {
      if (team === null || team.poolId !== pool._id) {
        throw new Error('Elige equipos validos.')
      }
    }

    for (const tier of tiers) {
      const picksForTier = teams.filter((team) => team?.tierId === tier._id)

      if (picksForTier.length !== tier.requiredPicks) {
        throw new Error(`Elige ${tier.requiredPicks} equipos en ${tier.name}.`)
      }
    }

    if (new Set(args.goalscorerPickIds.map((pick) => pick.tierId)).size !== tiers.length) {
      throw new Error('Elige un goleador de cada bombo.')
    }

    for (const tier of tiers) {
      const goalscorerPick = goalscorerPicks.find((pick) => pick.tierId === tier._id)

      if (goalscorerPick === undefined) {
        throw new Error(`Elige un goleador en ${tier.name}.`)
      }

      if (
        goalscorerPick.player === null ||
        goalscorerPick.player.poolId !== pool._id ||
        !goalscorerPick.player.isActive
      ) {
        throw new Error('Elige goleadores validos.')
      }

      const playerTeam =
        goalscorerPick.player.teamId === undefined
          ? null
          : await ctx.db.get(goalscorerPick.player.teamId)

      if (playerTeam === undefined || playerTeam === null || playerTeam.tierId !== tier._id) {
        throw new Error(`El goleador de ${tier.name} debe ser de un equipo de ese bombo.`)
      }
    }

    const existingEntry = await ctx.db
      .query('entries')
      .withIndex('by_poolId_and_participantId', (q) =>
        q.eq('poolId', pool._id).eq('participantId', participant._id),
      )
      .unique()
    const now = Date.now()
    const entryId =
      existingEntry === null
        ? await ctx.db.insert('entries', {
            poolId: pool._id,
            participantId: participant._id,
            goalscorerPickId: null,
            submittedAt: now,
            updatedAt: now,
          })
        : existingEntry._id

    if (existingEntry !== null) {
      await ctx.db.patch(existingEntry._id, {
        goalscorerPickId: null,
        submittedAt: existingEntry.submittedAt ?? now,
        updatedAt: now,
      })

      const existingPicks = await ctx.db
        .query('entryTeamPicks')
        .withIndex('by_entryId', (q) => q.eq('entryId', existingEntry._id))
        .take(100)

      for (const pick of existingPicks) {
        await ctx.db.delete(pick._id)
      }

      const existingGoalscorerPicks = await ctx.db
        .query('entryGoalscorerPicks')
        .withIndex('by_entryId', (q) => q.eq('entryId', existingEntry._id))
        .take(100)

      for (const pick of existingGoalscorerPicks) {
        await ctx.db.delete(pick._id)
      }
    }

    for (const team of teams) {
      if (team === null) {
        throw new Error('Elige equipos validos.')
      }

      await ctx.db.insert('entryTeamPicks', {
        poolId: pool._id,
        entryId,
        tierId: team.tierId,
        teamId: team._id,
      })
    }

    for (const pick of goalscorerPicks) {
      if (pick.player === null) {
        throw new Error('Elige goleadores validos.')
      }

      await ctx.db.insert('entryGoalscorerPicks', {
        poolId: pool._id,
        entryId,
        tierId: pick.tierId,
        eligiblePlayerId: pick.player._id,
      })
    }

    return { entryId }
  },
})

export const importEligiblePlayersForAdmin = mutation({
  args: {
    scriptSecret: v.string(),
    slug: v.optional(v.string()),
    players: v.array(
      v.object({
        name: v.string(),
        teamFifaCode: v.string(),
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
      throw new Error('No se ha encontrado la porra.')
    }

    await ensureWorldCupSeedData(ctx, pool._id)

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(100)
    const teamsByCode = new Map(teams.map((team) => [team.fifaCode.toUpperCase(), team]))
    const importsByTeamCode = new Map<string, EligiblePlayerImport[]>()
    const skippedTeams = new Set<string>()

    for (const player of args.players) {
      const name = player.name.trim()
      const teamFifaCode = player.teamFifaCode.trim().toUpperCase()

      if (!name || !teamFifaCode) {
        continue
      }

      if (!teamsByCode.has(teamFifaCode)) {
        skippedTeams.add(teamFifaCode)
        continue
      }

      importsByTeamCode.set(teamFifaCode, [
        ...(importsByTeamCode.get(teamFifaCode) ?? []),
        { name, teamFifaCode },
      ])
    }

    let inserted = 0
    let activated = 0
    let updated = 0
    let deactivated = 0
    const allExistingPlayers = await ctx.db
      .query('eligiblePlayers')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(2000)

    for (const [teamFifaCode, teamPlayers] of importsByTeamCode) {
      const team = teamsByCode.get(teamFifaCode)

      if (team === undefined) {
        continue
      }

      const fetchedNames = new Set(teamPlayers.map((player) => normalizeKey(player.name)))
      const existingForTeam = allExistingPlayers.filter(
        (player) =>
          player.teamFifaCode === team.fifaCode ||
          player.teamId === team._id ||
          (player.teamFifaCode === undefined &&
            normalizeKey(player.teamName) === normalizeKey(team.name)),
      )
      const existingByName = new Map(
        existingForTeam.map((player) => [normalizeKey(player.name), player]),
      )

      for (const player of teamPlayers) {
        const existing = existingByName.get(normalizeKey(player.name))

        if (existing === undefined) {
          await ctx.db.insert('eligiblePlayers', {
            poolId: pool._id,
            name: player.name,
            teamName: team.name,
            teamId: team._id,
            teamFifaCode: team.fifaCode,
            isActive: true,
          })
          inserted += 1
          continue
        }

        await ctx.db.patch(existing._id, {
          name: player.name,
          teamName: team.name,
          teamId: team._id,
          teamFifaCode: team.fifaCode,
          isActive: true,
        })
        if (!existing.isActive) {
          activated += 1
        } else {
          updated += 1
        }
      }

      for (const existing of existingForTeam) {
        if (existing.isActive && !fetchedNames.has(normalizeKey(existing.name))) {
          await ctx.db.patch(existing._id, { isActive: false })
          deactivated += 1
        }
      }
    }

    return {
      teamsFetched: importsByTeamCode.size,
      playersReceived: [...importsByTeamCode.values()].reduce(
        (total, players) => total + players.length,
        0,
      ),
      inserted,
      activated,
      updated,
      deactivated,
      skippedTeams: [...skippedTeams].sort(),
    }
  },
})

export const loginForHttp = internalMutation({
  args: {
    loginName: v.string(),
    pin: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedLoginName = args.loginName.trim().toLowerCase()
    const pool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
      .unique()

    if (pool === null) {
      throw new Error('Pool has not been set up yet.')
    }

    const participant = await ctx.db
      .query('participants')
      .withIndex('by_poolId_and_loginName', (q) =>
        q.eq('poolId', pool._id).eq('loginName', normalizedLoginName),
      )
      .unique()

    if (participant === null || !(await verifyPin(args.pin, participant.pinHash))) {
      throw new Error('Participant name or PIN is incorrect.')
    }

    return {
      poolId: pool._id,
      participantId: participant._id,
      participantName: participant.displayName,
      isAdmin: participant.isAdmin,
    }
  },
})

export const createRefreshSession = internalMutation({
  args: {
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('participantSessions', {
      poolId: args.poolId,
      participantId: args.participantId,
      refreshTokenHash: args.refreshTokenHash,
      expiresAt: args.expiresAt,
      revokedAt: null,
    })
  },
})

export const rotateRefreshSession = internalMutation({
  args: {
    sessionId: v.id('participantSessions'),
    currentRefreshTokenHash: v.string(),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt <= Date.now() ||
      session.refreshTokenHash !== args.currentRefreshTokenHash
    ) {
      return null
    }

    await ctx.db.patch(args.sessionId, {
      refreshTokenHash: args.refreshTokenHash,
      expiresAt: args.expiresAt,
    })

    return {
      poolId: session.poolId,
      participantId: session.participantId,
    }
  },
})

export const revokeRefreshSession = internalMutation({
  args: {
    sessionId: v.id('participantSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)

    if (session !== null && session.revokedAt === null) {
      await ctx.db.patch(args.sessionId, { revokedAt: Date.now() })
    }

    return null
  },
})

export const upsertParticipantsFromCsv = mutation({
  args: {
    scriptSecret: v.string(),
    slug: v.optional(v.string()),
    users: v.array(
      v.object({
        username: v.string(),
        displayName: v.string(),
        pinHash: v.string(),
        isAdmin: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminScriptSecret(args.scriptSecret)

    const pool = await getOrCreatePool(ctx, args.slug ?? DEMO_SLUG)
    let inserted = 0
    let updated = 0

    await ensureWorldCupSeedData(ctx, pool._id)

    for (const user of args.users) {
      const loginName = user.username.trim().toLowerCase()
      const displayName = user.displayName.trim() || loginName
      const participant = await ctx.db
        .query('participants')
        .withIndex('by_poolId_and_loginName', (q) =>
          q.eq('poolId', pool._id).eq('loginName', loginName),
        )
        .unique()

      if (participant === null) {
        await ctx.db.insert('participants', {
          poolId: pool._id,
          displayName,
          loginName,
          pinHash: user.pinHash,
          isAdmin: user.isAdmin,
        })
        inserted += 1
      } else {
        await ctx.db.patch(participant._id, {
          displayName,
          pinHash: user.pinHash,
          isAdmin: user.isAdmin,
        })
        updated += 1
      }
    }

    return {
      poolId: pool._id,
      inserted,
      updated,
      untouched: true,
    }
  },
})

export const seedPreview = mutation({
  args: {},
  handler: async (ctx) => {
    const pool = await getOrCreatePool(ctx, DEMO_SLUG)
    const { teamsByName } = await ensurePreviewEligiblePlayers(ctx, pool._id)
    const previewMatches = await ensurePreviewMatches(ctx, pool._id)
    const users = [
      { username: 'admin', displayName: 'Admin Preview', pin: 'preview-admin', isAdmin: true },
      { username: 'jugador-uno', displayName: 'Jugador Uno', pin: 'preview-uno', isAdmin: false },
      { username: 'jugador-dos', displayName: 'Jugador Dos', pin: 'preview-dos', isAdmin: false },
      {
        username: 'jugador-tres',
        displayName: 'Jugador Tres',
        pin: 'preview-tres',
        isAdmin: false,
      },
    ]
    let insertedParticipants = 0
    let updatedParticipants = 0

    for (const user of users) {
      const existing = await ctx.db
        .query('participants')
        .withIndex('by_poolId_and_loginName', (q) =>
          q.eq('poolId', pool._id).eq('loginName', user.username),
        )
        .unique()
      const payload = {
        displayName: user.displayName,
        loginName: user.username,
        pinHash: await hashPin(user.pin),
        isAdmin: user.isAdmin,
      }

      if (existing === null) {
        await ctx.db.insert('participants', { poolId: pool._id, ...payload })
        insertedParticipants += 1
      } else {
        await ctx.db.patch(existing._id, payload)
        updatedParticipants += 1
      }
    }

    return {
      poolId: pool._id,
      teams: teamsByName.size,
      previewMatches,
      insertedParticipants,
      updatedParticipants,
    }
  },
})

async function insertTeam(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  tierId: Id<'teamTiers'>,
  name: string,
  fifaCode: string,
  groupCode: string,
) {
  return await ctx.db.insert('teams', { poolId, tierId, name, fifaCode, groupCode })
}

async function ensureWorldCupSeedData(ctx: MutationCtx, poolId: Id<'pools'>) {
  const existingTiers = await ctx.db
    .query('teamTiers')
    .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', poolId))
    .take(25)
  const existingTeams = await ctx.db
    .query('teams')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(100)
  const existingPlayers = await ctx.db
    .query('eligiblePlayers')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(2000)
  const existingStageBonuses = await ctx.db
    .query('stageBonuses')
    .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', poolId))
    .take(25)
  const tiersByOrder = new Map(existingTiers.map((tier) => [tier.sortOrder, tier._id]))
  const teamsByCode = new Map(existingTeams.map((team) => [team.fifaCode, team._id]))
  const teamsByName = new Map(existingTeams.map((team) => [team.name, team._id]))
  const stageBonusesByOrder = new Map(
    existingStageBonuses.map((bonus) => [bonus.sortOrder, bonus._id]),
  )
  for (const tier of tierSeed) {
    const existingTierId = tiersByOrder.get(tier.sortOrder)

    if (existingTierId === undefined) {
      tiersByOrder.set(
        tier.sortOrder,
        await ctx.db.insert('teamTiers', {
          poolId,
          name: tier.name,
          requiredPicks: tier.requiredPicks,
          multiplier: tier.multiplier,
          sortOrder: tier.sortOrder,
        }),
      )
    } else {
      await ctx.db.patch(existingTierId, {
        name: tier.name,
        requiredPicks: tier.requiredPicks,
        multiplier: tier.multiplier,
      })
    }
  }

  for (const team of teamSeed) {
    const existingId = teamsByCode.get(team.fifaCode)
    const tierId = tiersByOrder.get(team.tierOrder)

    if (tierId === undefined) {
      throw new Error('No se han podido preparar los bombos.')
    }

    if (existingId === undefined) {
      const teamId = await insertTeam(ctx, poolId, tierId, team.name, team.fifaCode, team.groupCode)
      teamsByCode.set(team.fifaCode, teamId)
      teamsByName.set(team.name, teamId)
    } else {
      await ctx.db.patch(existingId, {
        name: team.name,
        tierId,
        fifaCode: team.fifaCode,
        groupCode: team.groupCode,
      })
      teamsByName.set(team.name, existingId)
    }
  }

  for (const bonus of stageBonusSeed) {
    const existingBonusId = stageBonusesByOrder.get(bonus.sortOrder)

    if (existingBonusId === undefined) {
      stageBonusesByOrder.set(
        bonus.sortOrder,
        await ctx.db.insert('stageBonuses', {
          poolId,
          stage: bonus.stage,
          points: bonus.points,
          sortOrder: bonus.sortOrder,
        }),
      )
    } else {
      await ctx.db.patch(existingBonusId, {
        stage: bonus.stage,
        points: bonus.points,
      })
    }
  }

  const removedPlayerNames = new Set(['Alvaro Morata'])

  for (const player of existingPlayers) {
    if (removedPlayerNames.has(player.name) && player.isActive) {
      await ctx.db.patch(player._id, { isActive: false })
    }
  }

  return {
    tiersByOrder,
    teamsByName,
  }
}

async function ensurePreviewEligiblePlayers(ctx: MutationCtx, poolId: Id<'pools'>) {
  const { teamsByName } = await ensureWorldCupSeedData(ctx, poolId)
  const existingPlayers = await ctx.db
    .query('eligiblePlayers')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(2000)
  const existingByTeamAndName = new Map(
    existingPlayers.map((player) => [
      `${player.teamFifaCode ?? normalizeKey(player.teamName)}:${normalizeKey(player.name)}`,
      player,
    ]),
  )

  for (const teamSeedItem of teamSeed) {
    const teamId = teamsByName.get(teamSeedItem.name)

    if (teamId === undefined) {
      throw new Error('No se han podido preparar los jugadores de preview.')
    }

    for (let index = 1; index <= 3; index += 1) {
      const name = `${teamSeedItem.name} Preview ${index}`
      const key = `${teamSeedItem.fifaCode}:${normalizeKey(name)}`
      const existing = existingByTeamAndName.get(key)
      const payload = {
        poolId,
        name,
        teamName: teamSeedItem.name,
        teamId,
        teamFifaCode: teamSeedItem.fifaCode,
        isActive: true,
      }

      if (existing === undefined) {
        await ctx.db.insert('eligiblePlayers', payload)
      } else {
        await ctx.db.patch(existing._id, payload)
      }
    }
  }

  return { teamsByName }
}

async function ensurePreviewMatches(ctx: MutationCtx, poolId: Id<'pools'>) {
  const now = Date.now()
  const teams = await ctx.db
    .query('teams')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(200)
  const eligiblePlayers = await ctx.db
    .query('eligiblePlayers')
    .withIndex('by_poolId', (q) => q.eq('poolId', poolId))
    .take(2000)
  const existingMatches = await ctx.db
    .query('matches')
    .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', poolId))
    .take(200)
  const teamsByCode = new Map(teams.map((team) => [team.fifaCode.toUpperCase(), team]))
  const playersByTeamCode = new Map<string, Doc<'eligiblePlayers'>[]>()
  const existingByMatchNumber = new Map(existingMatches.map((match) => [match.matchNumber, match]))
  let inserted = 0
  let updated = 0

  for (const player of eligiblePlayers) {
    const teamCode = player.teamFifaCode?.toUpperCase()

    if (teamCode === undefined) {
      continue
    }

    playersByTeamCode.set(teamCode, [...(playersByTeamCode.get(teamCode) ?? []), player])
  }

  for (const players of playersByTeamCode.values()) {
    players.sort((left, right) => left.name.localeCompare(right.name))
  }

  for (const seed of previewMatchSeed) {
    const homeTeam = teamsByCode.get(seed.homeTeamFifaCode)
    const awayTeam = teamsByCode.get(seed.awayTeamFifaCode)

    if (homeTeam === undefined || awayTeam === undefined) {
      throw new Error('No se han podido preparar los partidos de preview.')
    }

    const existing = existingByMatchNumber.get(seed.matchNumber) ?? null
    const payload = {
      poolId,
      matchNumber: seed.matchNumber,
      fifaMatchId: `preview-${seed.matchNumber}`,
      stage: seed.stage,
      groupName: seed.groupName,
      kickoffAt: now + seed.offsetMs,
      venueName: seed.venueName,
      venueCity: seed.venueCity,
      homePlaceholder: homeTeam.name,
      awayPlaceholder: awayTeam.name,
      homeTeamId: homeTeam._id,
      awayTeamId: awayTeam._id,
      source: 'Preview inventado',
      sourceUrl: 'https://example.com/world-cup-pool-preview',
      sourceUpdatedAt: now,
    }
    const matchId = existing === null ? await ctx.db.insert('matches', payload) : existing._id

    if (existing === null) {
      const created = await ctx.db.get(matchId)
      if (created !== null) {
        existingByMatchNumber.set(seed.matchNumber, created)
      }
      inserted += 1
    } else {
      await ctx.db.patch(existing._id, payload)
      updated += 1
    }

    if (seed.result !== undefined) {
      await ensurePreviewMatchResult(ctx, {
        poolId,
        matchId,
        result: seed.result,
        teamsByCode,
        playersByTeamCode,
        now,
      })
    }
  }

  return {
    inserted,
    updated,
  }
}

async function ensurePreviewMatchResult(
  ctx: MutationCtx,
  args: {
    poolId: Id<'pools'>
    matchId: Id<'matches'>
    result: NonNullable<PreviewMatchSeed['result']>
    teamsByCode: Map<string, Doc<'teams'>>
    playersByTeamCode: Map<string, Doc<'eligiblePlayers'>[]>
    now: number
  },
) {
  const existingResult = await ctx.db
    .query('matchResults')
    .withIndex('by_matchId', (q) => q.eq('matchId', args.matchId))
    .unique()
  const existingGoals = await ctx.db
    .query('matchGoals')
    .withIndex('by_matchId_and_sortOrder', (q) => q.eq('matchId', args.matchId))
    .take(100)

  if (existingResult === null) {
    await ctx.db.insert('matchResults', {
      poolId: args.poolId,
      matchId: args.matchId,
      homeGoals: args.result.homeGoals,
      awayGoals: args.result.awayGoals,
      penaltyShootoutWinnerTeamId: null,
      updatedAt: args.now,
      updatedByParticipantId: null,
    })
  }

  if (existingGoals.length > 0) {
    return
  }

  for (const [index, goal] of args.result.goals.entries()) {
    const scoringTeam = args.teamsByCode.get(goal.scoringTeamFifaCode)
    const creditedPlayers = args.playersByTeamCode.get(goal.creditedTeamFifaCode) ?? []
    const creditedPlayer = creditedPlayers[goal.playerPreviewIndex - 1]

    if (scoringTeam === undefined || creditedPlayer === undefined) {
      throw new Error('No se han podido preparar los goles de preview.')
    }

    await ctx.db.insert('matchGoals', {
      poolId: args.poolId,
      matchId: args.matchId,
      scoringTeamId: scoringTeam._id,
      creditedPlayerId: creditedPlayer._id,
      isOwnGoal: goal.isOwnGoal ?? false,
      minuteLabel: goal.minuteLabel,
      sortOrder: index + 1,
      updatedAt: args.now,
      updatedByParticipantId: null,
    })
  }
}

async function getOrCreatePool(ctx: MutationCtx, slug: string) {
  const existingPool = await ctx.db
    .query('pools')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()

  if (existingPool !== null) {
    return existingPool
  }

  const poolId = await ctx.db.insert('pools', {
    name: 'World Cup 2026 Pool',
    slug,
    entryLockAt: DEFAULT_ENTRY_LOCK_AT,
    adminPin: 'change-me',
    status: 'open',
  })
  const createdPool = await ctx.db.get(poolId)

  if (createdPool === null) {
    throw new Error('Failed to create pool.')
  }

  await ensureWorldCupSeedData(ctx, createdPool._id)

  return createdPool
}

function getEligiblePlayerTeamFields(
  player: Doc<'eligiblePlayers'>,
  teamsById: Map<Id<'teams'>, Doc<'teams'>>,
  teamsByName: Map<string, Doc<'teams'>>,
  teamsByCode: Map<string, Doc<'teams'>>,
) {
  const team =
    (player.teamId === undefined ? undefined : teamsById.get(player.teamId)) ??
    (player.teamFifaCode === undefined ? undefined : teamsByCode.get(player.teamFifaCode)) ??
    teamsByName.get(player.teamName)

  return {
    teamId: team?._id ?? null,
    tierId: team?.tierId ?? null,
    teamName: team?.name ?? player.teamName,
    teamFifaCode: team?.fifaCode ?? player.teamFifaCode ?? '',
    groupCode: team?.groupCode ?? '?',
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
