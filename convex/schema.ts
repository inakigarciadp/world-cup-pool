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
    goalscorerPickId: v.union(v.id('eligiblePlayers'), v.null()),
    currentScore: v.number(),
    submittedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  })
    .index('by_poolId', ['poolId'])
    .index('by_poolId_and_participantId', ['poolId', 'participantId'])
    .index('by_poolId_and_currentScore', ['poolId', 'currentScore']),

  entryTeamPicks: defineTable({
    poolId: v.id('pools'),
    entryId: v.id('entries'),
    tierId: v.id('teamTiers'),
    teamId: v.id('teams'),
  })
    .index('by_entryId', ['entryId'])
    .index('by_poolId', ['poolId']),
})
