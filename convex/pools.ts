import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const DEMO_SLUG = 'world-cup-2026'
const SESSION_LENGTH_MS = 1000 * 60 * 60 * 24 * 30
const DEFAULT_ENTRY_LOCK_AT = Date.UTC(2026, 5, 11, 19, 0, 0)

type EntryOverview = {
  entryId: Id<'entries'>
  participantName: string
  goalscorerPick: string | null
  teamPicks: Array<{
    tierName: string
    teamName: string
  }>
  currentScore: number
  submittedAt: number | null
}

export const getAuthenticatedOverview = query({
  args: {
    sessionToken: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await getValidSession(ctx, args.sessionToken)

    if (session === null) {
      return null
    }

    const pool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug ?? DEMO_SLUG))
      .unique()

    if (pool === null || pool._id !== session.poolId) {
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
      .take(200)
    const stageBonuses = await ctx.db
      .query('stageBonuses')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', pool._id))
      .take(25)
    const entries = await ctx.db
      .query('entries')
      .withIndex('by_poolId_and_currentScore', (q) => q.eq('poolId', pool._id))
      .order('desc')
      .take(100)
    const entryTeamPicks = await ctx.db
      .query('entryTeamPicks')
      .withIndex('by_poolId', (q) => q.eq('poolId', pool._id))
      .take(500)

    const participantsById = new Map(participants.map((participant) => [participant._id, participant]))
    const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
    const teamsById = new Map(teams.map((team) => [team._id, team]))
    const eligiblePlayersById = new Map(eligiblePlayers.map((player) => [player._id, player]))
    const picksByEntryId = new Map<Id<'entries'>, Doc<'entryTeamPicks'>[]>()

    for (const pick of entryTeamPicks) {
      const existing = picksByEntryId.get(pick.entryId) ?? []
      existing.push(pick)
      picksByEntryId.set(pick.entryId, existing)
    }

    const entryOverviews: EntryOverview[] = entries.map((entry) => {
      const participant = participantsById.get(entry.participantId)
      const goalscorerPick =
        entry.goalscorerPickId === null ? null : eligiblePlayersById.get(entry.goalscorerPickId)?.name ?? null
      const teamPicks = (picksByEntryId.get(entry._id) ?? [])
        .map((pick) => {
          const tier = tiersById.get(pick.tierId)
          const team = teamsById.get(pick.teamId)

          return {
            tierName: tier?.name ?? 'Unknown tier',
            teamName: team?.name ?? 'Unknown team',
            sortOrder: tier?.sortOrder ?? 999,
          }
        })
        .sort((left, right) => left.sortOrder - right.sortOrder || left.teamName.localeCompare(right.teamName))
        .map(({ tierName, teamName }) => ({ tierName, teamName }))

      return {
        entryId: entry._id,
        participantName: participant?.displayName ?? 'Unknown participant',
        goalscorerPick,
        teamPicks,
        currentScore: entry.currentScore,
        submittedAt: entry.submittedAt,
      }
    })

    return {
      session: {
        participantName: session.participant.displayName,
        isAdmin: session.participant.isAdmin,
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
        teams: teams
          .filter((team) => team.tierId === tier._id)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((team) => ({
            id: team._id,
            name: team.name,
            fifaCode: team.fifaCode,
          })),
      })),
      eligiblePlayers: eligiblePlayers
        .filter((player) => player.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((player) => ({
          id: player._id,
          name: player.name,
          teamName: player.teamName,
        })),
      stageBonuses: stageBonuses.map((bonus) => ({
        id: bonus._id,
        stage: bonus.stage,
        points: bonus.points,
      })),
      leaderboard: entryOverviews.sort(
        (left, right) => right.currentScore - left.currentScore || left.participantName.localeCompare(right.participantName),
      ),
    }
  },
})

export const login = mutation({
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
      .withIndex('by_poolId_and_loginName', (q) => q.eq('poolId', pool._id).eq('loginName', normalizedLoginName))
      .unique()

    if (participant === null || participant.pin !== args.pin) {
      throw new Error('Participant name or PIN is incorrect.')
    }

    const token = crypto.randomUUID()
    await ctx.db.insert('participantSessions', {
      poolId: pool._id,
      participantId: participant._id,
      token,
      expiresAt: Date.now() + SESSION_LENGTH_MS,
    })

    return {
      token,
      participantName: participant.displayName,
      isAdmin: participant.isAdmin,
    }
  },
})

export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('participantSessions')
      .withIndex('by_token', (q) => q.eq('token', args.sessionToken))
      .unique()

    if (session !== null) {
      await ctx.db.delete(session._id)
    }

    return null
  },
})

export const upsertParticipantsFromCsv = mutation({
  args: {
    slug: v.optional(v.string()),
    users: v.array(
      v.object({
        username: v.string(),
        displayName: v.string(),
        pin: v.string(),
        isAdmin: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const pool = await getOrCreatePool(ctx, args.slug ?? DEMO_SLUG)
    let inserted = 0
    let updated = 0

    for (const user of args.users) {
      const loginName = user.username.trim().toLowerCase()
      const displayName = user.displayName.trim() || loginName
      const participant = await ctx.db
        .query('participants')
        .withIndex('by_poolId_and_loginName', (q) => q.eq('poolId', pool._id).eq('loginName', loginName))
        .unique()

      if (participant === null) {
        await ctx.db.insert('participants', {
          poolId: pool._id,
          displayName,
          loginName,
          pin: user.pin,
          isAdmin: user.isAdmin,
        })
        inserted += 1
      } else {
        await ctx.db.patch(participant._id, {
          displayName,
          pin: user.pin,
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

export const seedDemoPool = mutation({
  args: {},
  handler: async (ctx) => {
    const existingPool = await ctx.db
      .query('pools')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_SLUG))
      .unique()

    if (existingPool !== null) {
      return existingPool._id
    }

    const now = Date.now()
    const poolId = await ctx.db.insert('pools', {
      name: 'World Cup 2026 Pool',
      slug: DEMO_SLUG,
      entryLockAt: DEFAULT_ENTRY_LOCK_AT,
      adminPin: 'change-me',
      status: 'open',
    })

    const contenderTierId = await ctx.db.insert('teamTiers', {
      poolId,
      name: 'Contenders',
      requiredPicks: 2,
      sortOrder: 1,
    })
    const chasingTierId = await ctx.db.insert('teamTiers', {
      poolId,
      name: 'Chasing Pack',
      requiredPicks: 2,
      sortOrder: 2,
    })
    const wildcardTierId = await ctx.db.insert('teamTiers', {
      poolId,
      name: 'Wildcards',
      requiredPicks: 1,
      sortOrder: 3,
    })

    const argentinaId = await insertTeam(ctx, poolId, contenderTierId, 'Argentina', 'ARG')
    const brazilId = await insertTeam(ctx, poolId, contenderTierId, 'Brazil', 'BRA')
    const franceId = await insertTeam(ctx, poolId, contenderTierId, 'France', 'FRA')
    const spainId = await insertTeam(ctx, poolId, contenderTierId, 'Spain', 'ESP')
    const englandId = await insertTeam(ctx, poolId, chasingTierId, 'England', 'ENG')
    const germanyId = await insertTeam(ctx, poolId, chasingTierId, 'Germany', 'GER')
    const portugalId = await insertTeam(ctx, poolId, chasingTierId, 'Portugal', 'POR')
    const netherlandsId = await insertTeam(ctx, poolId, chasingTierId, 'Netherlands', 'NED')
    const usaId = await insertTeam(ctx, poolId, wildcardTierId, 'United States', 'USA')
    const mexicoId = await insertTeam(ctx, poolId, wildcardTierId, 'Mexico', 'MEX')

    const messiId = await insertEligiblePlayer(ctx, poolId, 'Lionel Messi', 'Argentina')
    const mbappeId = await insertEligiblePlayer(ctx, poolId, 'Kylian Mbappe', 'France')
    const kaneId = await insertEligiblePlayer(ctx, poolId, 'Harry Kane', 'England')

    await ctx.db.insert('stageBonuses', { poolId, stage: 'Round of 16', points: 2, sortOrder: 1 })
    await ctx.db.insert('stageBonuses', { poolId, stage: 'Quarterfinal', points: 4, sortOrder: 2 })
    await ctx.db.insert('stageBonuses', { poolId, stage: 'Semifinal', points: 7, sortOrder: 3 })
    await ctx.db.insert('stageBonuses', { poolId, stage: 'Champion', points: 12, sortOrder: 4 })

    const anaId = await insertParticipant(ctx, poolId, 'Ana', 'ana', 'pool', true)
    const diegoId = await insertParticipant(ctx, poolId, 'Diego', 'diego', 'pool', false)
    const mayaId = await insertParticipant(ctx, poolId, 'Maya', 'maya', 'pool', false)

    await insertEntry(ctx, poolId, anaId, messiId, now, [
      [contenderTierId, argentinaId],
      [contenderTierId, franceId],
      [chasingTierId, portugalId],
      [chasingTierId, germanyId],
      [wildcardTierId, usaId],
    ])
    await insertEntry(ctx, poolId, diegoId, mbappeId, now, [
      [contenderTierId, franceId],
      [contenderTierId, brazilId],
      [chasingTierId, englandId],
      [chasingTierId, netherlandsId],
      [wildcardTierId, mexicoId],
    ])
    await insertEntry(ctx, poolId, mayaId, kaneId, now, [
      [contenderTierId, spainId],
      [contenderTierId, argentinaId],
      [chasingTierId, englandId],
      [chasingTierId, portugalId],
      [wildcardTierId, usaId],
    ])

    return poolId
  },
})

async function insertTeam(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  tierId: Id<'teamTiers'>,
  name: string,
  fifaCode: string,
) {
  return await ctx.db.insert('teams', { poolId, tierId, name, fifaCode })
}

async function insertEligiblePlayer(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  name: string,
  teamName: string,
) {
  return await ctx.db.insert('eligiblePlayers', { poolId, name, teamName, isActive: true })
}

async function insertParticipant(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  displayName: string,
  loginName: string,
  pin: string,
  isAdmin: boolean,
) {
  return await ctx.db.insert('participants', {
    poolId,
    displayName,
    loginName,
    pin,
    isAdmin,
  })
}

async function insertEntry(
  ctx: MutationCtx,
  poolId: Id<'pools'>,
  participantId: Id<'participants'>,
  goalscorerPickId: Id<'eligiblePlayers'>,
  submittedAt: number,
  teamPicks: Array<[Id<'teamTiers'>, Id<'teams'>]>,
) {
  const entryId = await ctx.db.insert('entries', {
    poolId,
    participantId,
    goalscorerPickId,
    currentScore: 0,
    submittedAt,
    updatedAt: submittedAt,
  })

  for (const [tierId, teamId] of teamPicks) {
    await ctx.db.insert('entryTeamPicks', { poolId, entryId, tierId, teamId })
  }
}

async function getValidSession(ctx: QueryCtx, sessionToken: string) {
  const session = await ctx.db
    .query('participantSessions')
    .withIndex('by_token', (q) => q.eq('token', sessionToken))
    .unique()

  if (session === null || session.expiresAt <= Date.now()) {
    return null
  }

  const participant = await ctx.db.get(session.participantId)

  if (participant === null) {
    return null
  }

  return {
    ...session,
    participant,
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
    status: 'setup',
  })
  const createdPool = await ctx.db.get(poolId)

  if (createdPool === null) {
    throw new Error('Failed to create pool.')
  }

  return createdPool
}
