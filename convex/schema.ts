import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  pools: defineTable({
    name: v.string(),
    slug: v.string(),
    entryLockAt: v.number(),
    adminPin: v.string(),
    status: v.union(
      v.literal('setup'),
      v.literal('open'),
      v.literal('locked'),
      v.literal('scoring'),
    ),
  }).index('by_slug', ['slug']),

  participants: defineTable({
    poolId: v.id('pools'),
    displayName: v.string(),
    loginName: v.string(),
    pinHash: v.string(),
    isAdmin: v.boolean(),
  })
    .index('by_poolId', ['poolId'])
    .index('by_poolId_and_loginName', ['poolId', 'loginName']),

  participantSessions: defineTable({
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index('by_refreshTokenHash', ['refreshTokenHash'])
    .index('by_participantId', ['participantId']),

  teamTiers: defineTable({
    poolId: v.id('pools'),
    name: v.string(),
    requiredPicks: v.number(),
    multiplier: v.optional(v.number()),
    sortOrder: v.number(),
  }).index('by_poolId_and_sortOrder', ['poolId', 'sortOrder']),

  teams: defineTable({
    poolId: v.id('pools'),
    tierId: v.id('teamTiers'),
    name: v.string(),
    fifaCode: v.string(),
    groupCode: v.optional(v.string()),
  })
    .index('by_poolId', ['poolId'])
    .index('by_tierId', ['tierId']),

  eligiblePlayers: defineTable({
    poolId: v.id('pools'),
    name: v.string(),
    teamName: v.string(),
    teamId: v.optional(v.id('teams')),
    teamFifaCode: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_poolId', ['poolId'])
    .index('by_poolId_and_teamFifaCode', ['poolId', 'teamFifaCode']),

  stageBonuses: defineTable({
    poolId: v.id('pools'),
    stage: v.string(),
    points: v.number(),
    sortOrder: v.number(),
  }).index('by_poolId_and_sortOrder', ['poolId', 'sortOrder']),

  entries: defineTable({
    poolId: v.id('pools'),
    participantId: v.id('participants'),
    goalscorerPickId: v.optional(v.union(v.id('eligiblePlayers'), v.null())),
    // Deprecated: live scoring derives this from scoring facts.
    currentScore: v.optional(v.number()),
    submittedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  })
    .index('by_poolId', ['poolId'])
    .index('by_poolId_and_participantId', ['poolId', 'participantId']),

  entryTeamPicks: defineTable({
    poolId: v.id('pools'),
    entryId: v.id('entries'),
    tierId: v.id('teamTiers'),
    teamId: v.id('teams'),
  })
    .index('by_entryId', ['entryId'])
    .index('by_poolId', ['poolId']),

  entryGoalscorerPicks: defineTable({
    poolId: v.id('pools'),
    entryId: v.id('entries'),
    tierId: v.id('teamTiers'),
    eligiblePlayerId: v.id('eligiblePlayers'),
  })
    .index('by_entryId', ['entryId'])
    .index('by_poolId', ['poolId']),

  matches: defineTable({
    poolId: v.id('pools'),
    matchNumber: v.number(),
    fifaMatchId: v.string(),
    stage: v.string(),
    groupName: v.union(v.string(), v.null()),
    kickoffAt: v.number(),
    venueName: v.string(),
    venueCity: v.string(),
    homePlaceholder: v.string(),
    awayPlaceholder: v.string(),
    homeTeamId: v.union(v.id('teams'), v.null()),
    awayTeamId: v.union(v.id('teams'), v.null()),
    source: v.string(),
    sourceUrl: v.string(),
    sourceUpdatedAt: v.number(),
  })
    .index('by_poolId_and_kickoffAt', ['poolId', 'kickoffAt'])
    .index('by_poolId_and_matchNumber', ['poolId', 'matchNumber']),

  matchResults: defineTable({
    poolId: v.id('pools'),
    matchId: v.id('matches'),
    homeGoals: v.number(),
    awayGoals: v.number(),
    penaltyShootoutWinnerTeamId: v.union(v.id('teams'), v.null()),
    updatedAt: v.number(),
    updatedByParticipantId: v.union(v.id('participants'), v.null()),
  })
    .index('by_matchId', ['matchId'])
    .index('by_poolId', ['poolId']),

  matchGoals: defineTable({
    poolId: v.id('pools'),
    matchId: v.id('matches'),
    scoringTeamId: v.id('teams'),
    creditedPlayerId: v.id('eligiblePlayers'),
    isOwnGoal: v.boolean(),
    minuteLabel: v.union(v.string(), v.null()),
    sortOrder: v.number(),
    updatedAt: v.number(),
    updatedByParticipantId: v.union(v.id('participants'), v.null()),
  })
    .index('by_matchId_and_sortOrder', ['matchId', 'sortOrder'])
    .index('by_poolId', ['poolId'])
    .index('by_creditedPlayerId', ['creditedPlayerId']),

  topScorerConfirmations: defineTable({
    poolId: v.id('pools'),
    eligiblePlayerId: v.id('eligiblePlayers'),
    confirmedAt: v.number(),
    confirmedByParticipantId: v.id('participants'),
  })
    .index('by_poolId', ['poolId'])
    .index('by_poolId_and_eligiblePlayerId', ['poolId', 'eligiblePlayerId']),
})
