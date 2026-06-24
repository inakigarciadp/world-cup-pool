import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const teamTierSummary = v.object({
  id: v.id('teamTiers'),
  name: v.string(),
  requiredPicks: v.number(),
  multiplier: v.union(v.number(), v.null()),
})

const leaderboardEntryProjection = v.object({
  entryId: v.union(v.id('entries'), v.null()),
  participantId: v.id('participants'),
  participantName: v.string(),
  currentScore: v.number(),
  submittedAt: v.union(v.number(), v.null()),
})

const entryTeamPickOverviewProjection = v.object({
  tierName: v.string(),
  teamName: v.string(),
})

const entryGoalscorerPickOverviewProjection = v.object({
  tierName: v.string(),
  playerName: v.string(),
  teamName: v.string(),
})

const entryOverviewProjection = v.object({
  entryId: v.union(v.id('entries'), v.null()),
  participantId: v.id('participants'),
  participantName: v.string(),
  goalscorerPicks: v.array(entryGoalscorerPickOverviewProjection),
  teamPicks: v.array(entryTeamPickOverviewProjection),
  currentScore: v.number(),
  submittedAt: v.union(v.number(), v.null()),
})

const teamOption = v.object({
  id: v.id('teams'),
  name: v.string(),
  fifaCode: v.string(),
  groupCode: v.string(),
})

const teamTierOptionProjection = v.object({
  id: v.id('teamTiers'),
  name: v.string(),
  requiredPicks: v.number(),
  multiplier: v.union(v.number(), v.null()),
  teams: v.array(teamOption),
})

const entryEligiblePlayerOptionProjection = v.object({
  id: v.id('eligiblePlayers'),
  name: v.string(),
  teamId: v.union(v.id('teams'), v.null()),
  tierId: v.union(v.id('teamTiers'), v.null()),
  teamName: v.string(),
  teamFifaCode: v.string(),
  groupCode: v.string(),
})

const currentEntryProjection = v.object({
  participantId: v.id('participants'),
  teamPickIds: v.array(v.id('teams')),
  goalscorerPickIds: v.array(
    v.object({
      tierId: v.id('teamTiers'),
      eligiblePlayerId: v.id('eligiblePlayers'),
    }),
  ),
})

const matchSideProjection = v.object({
  placeholder: v.string(),
  team: v.union(teamOption, v.null()),
})

const matchGoalProjection = v.object({
  id: v.id('matchGoals'),
  scoringTeamId: v.id('teams'),
  scoringTeamName: v.string(),
  creditedPlayerId: v.id('eligiblePlayers'),
  creditedPlayerName: v.string(),
  creditedPlayerTeamId: v.union(v.id('teams'), v.null()),
  creditedPlayerTeamName: v.string(),
  isOwnGoal: v.boolean(),
  minuteLabel: v.union(v.string(), v.null()),
  sortOrder: v.number(),
})

const matchStakeProjection = v.union(
  v.object({
    kind: v.literal('teamPick'),
    teamId: v.id('teams'),
    teamName: v.string(),
    tierName: v.string(),
  }),
  v.object({
    kind: v.literal('goalscorerPick'),
    eligiblePlayerId: v.id('eligiblePlayers'),
    playerName: v.string(),
    teamId: v.id('teams'),
    teamName: v.string(),
    tierName: v.string(),
  }),
)

const matchStakeGroupProjection = v.object({
  participantId: v.id('participants'),
  participantName: v.string(),
  stakes: v.array(matchStakeProjection),
})

const matchCardProjection = v.object({
  id: v.id('matches'),
  matchNumber: v.number(),
  stage: v.string(),
  groupName: v.union(v.string(), v.null()),
  kickoffAt: v.number(),
  venueName: v.string(),
  venueCity: v.string(),
  home: matchSideProjection,
  away: matchSideProjection,
  result: v.union(
    v.object({
      homeGoals: v.number(),
      awayGoals: v.number(),
      penaltyShootoutWinnerTeamId: v.union(v.id('teams'), v.null()),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  goals: v.array(matchGoalProjection),
  stakes: v.array(matchStakeGroupProjection),
})

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

  entriesProjections: defineTable({
    poolId: v.id('pools'),
    pool: v.object({
      entryLockAt: v.number(),
      status: v.union(
        v.literal('setup'),
        v.literal('open'),
        v.literal('locked'),
        v.literal('scoring'),
      ),
    }),
    teamTiers: v.array(teamTierOptionProjection),
    eligiblePlayers: v.array(entryEligiblePlayerOptionProjection),
    leaderboard: v.array(entryOverviewProjection),
    currentEntries: v.array(currentEntryProjection),
    updatedAt: v.number(),
    updatedByParticipantId: v.union(v.id('participants'), v.null()),
  }).index('by_poolId', ['poolId']),

  leaderboardProjections: defineTable({
    poolId: v.id('pools'),
    teamTiers: v.array(teamTierSummary),
    leaderboard: v.array(leaderboardEntryProjection),
    updatedAt: v.number(),
    updatedByParticipantId: v.union(v.id('participants'), v.null()),
  }).index('by_poolId', ['poolId']),

  matchProjections: defineTable({
    poolId: v.id('pools'),
    matchId: v.id('matches'),
    kickoffAt: v.number(),
    matchNumber: v.number(),
    card: matchCardProjection,
    stakeParticipantIds: v.array(v.id('participants')),
    updatedAt: v.number(),
    updatedByParticipantId: v.union(v.id('participants'), v.null()),
  })
    .index('by_poolId_and_kickoffAt', ['poolId', 'kickoffAt'])
    .index('by_matchId', ['matchId']),
})
