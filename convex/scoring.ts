import { v } from 'convex/values'

import { internalQuery } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { stageBonusSeed, topScorerBonus, worldCupWinnerBonus } from './scoringRules'

const MAX_ENTRIES = 200
const MAX_TIERS = 25
const MAX_PICKS = 1000
const MAX_MATCHES = 200
const MAX_RESULTS = 200
const MAX_GOALS = 3000
const MAX_TOP_SCORER_CONFIRMATIONS = 200

const stageBonusPointsByStage = new Map(stageBonusSeed.map((bonus) => [bonus.stage, bonus.points]))

type EntryScore = {
  entryId: Id<'entries'>
  participantId: Id<'participants'>
  currentScore: number
}

export const getLeaderboardScoresForPool = internalQuery({
  args: {
    poolId: v.id('pools'),
  },
  handler: async (ctx, args): Promise<EntryScore[]> => {
    const entries = await ctx.db
      .query('entries')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_ENTRIES)
    const tiers = await ctx.db
      .query('teamTiers')
      .withIndex('by_poolId_and_sortOrder', (q) => q.eq('poolId', args.poolId))
      .take(MAX_TIERS)
    const teamPicks = await ctx.db
      .query('entryTeamPicks')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_PICKS)
    const goalscorerPicks = await ctx.db
      .query('entryGoalscorerPicks')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_PICKS)
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_poolId_and_matchNumber', (q) => q.eq('poolId', args.poolId))
      .take(MAX_MATCHES)
    const results = await ctx.db
      .query('matchResults')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_RESULTS)
    const goals = await ctx.db
      .query('matchGoals')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_GOALS)
    const topScorerConfirmations = await ctx.db
      .query('topScorerConfirmations')
      .withIndex('by_poolId', (q) => q.eq('poolId', args.poolId))
      .take(MAX_TOP_SCORER_CONFIRMATIONS)

    const tiersById = new Map(tiers.map((tier) => [tier._id, tier]))
    const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]))
    const teamPicksByEntryId = groupByEntry(teamPicks)
    const goalscorerPicksByEntryId = groupByEntry(goalscorerPicks)
    const teamMatchPoints = calculateTeamMatchPoints(matches, resultsByMatchId)
    const teamStageBonusPoints = calculateTeamStageBonusPoints(matches)
    const teamWinnerBonusPoints = calculateTeamWinnerBonusPoints(matches, resultsByMatchId)
    const goalsByPlayerId = calculateGoalsByPlayerId(goals)
    const confirmedTopScorerIds = new Set(
      topScorerConfirmations.map((confirmation) => confirmation.eligiblePlayerId),
    )

    return entries
      .map((entry) => ({
        entryId: entry._id,
        participantId: entry.participantId,
        currentScore: roundScore(
          calculateEntryScore({
            teamPicks: teamPicksByEntryId.get(entry._id) ?? [],
            goalscorerPicks: goalscorerPicksByEntryId.get(entry._id) ?? [],
            tiersById,
            teamMatchPoints,
            teamStageBonusPoints,
            teamWinnerBonusPoints,
            goalsByPlayerId,
            confirmedTopScorerIds,
          }),
        ),
      }))
      .sort(
        (left, right) =>
          right.currentScore - left.currentScore ||
          String(left.participantId).localeCompare(String(right.participantId)),
      )
  },
})

function calculateEntryScore({
  teamPicks,
  goalscorerPicks,
  tiersById,
  teamMatchPoints,
  teamStageBonusPoints,
  teamWinnerBonusPoints,
  goalsByPlayerId,
  confirmedTopScorerIds,
}: {
  teamPicks: Doc<'entryTeamPicks'>[]
  goalscorerPicks: Doc<'entryGoalscorerPicks'>[]
  tiersById: Map<Id<'teamTiers'>, Doc<'teamTiers'>>
  teamMatchPoints: Map<Id<'teams'>, number>
  teamStageBonusPoints: Map<Id<'teams'>, number>
  teamWinnerBonusPoints: Map<Id<'teams'>, number>
  goalsByPlayerId: Map<Id<'eligiblePlayers'>, number>
  confirmedTopScorerIds: Set<Id<'eligiblePlayers'>>
}) {
  let total = 0

  for (const pick of teamPicks) {
    const multiplier = getTierMultiplier(tiersById.get(pick.tierId))

    total += (teamMatchPoints.get(pick.teamId) ?? 0) * multiplier
    total += (teamStageBonusPoints.get(pick.teamId) ?? 0) * multiplier
    total += (teamWinnerBonusPoints.get(pick.teamId) ?? 0) * multiplier
  }

  for (const pick of goalscorerPicks) {
    const multiplier = getTierMultiplier(tiersById.get(pick.tierId))

    total += (goalsByPlayerId.get(pick.eligiblePlayerId) ?? 0) * multiplier

    if (confirmedTopScorerIds.has(pick.eligiblePlayerId)) {
      total += topScorerBonus
    }
  }

  return total
}

function calculateTeamMatchPoints(
  matches: Doc<'matches'>[],
  resultsByMatchId: Map<Id<'matches'>, Doc<'matchResults'>>,
) {
  const pointsByTeamId = new Map<Id<'teams'>, number>()

  for (const match of matches) {
    const result = resultsByMatchId.get(match._id)

    if (result === undefined || match.homeTeamId === null || match.awayTeamId === null) {
      continue
    }

    if (result.homeGoals > result.awayGoals) {
      addPoints(pointsByTeamId, match.homeTeamId, 3)
      continue
    }

    if (result.awayGoals > result.homeGoals) {
      addPoints(pointsByTeamId, match.awayTeamId, 3)
      continue
    }

    if (result.penaltyShootoutWinnerTeamId === match.homeTeamId) {
      addPoints(pointsByTeamId, match.homeTeamId, 2)
      addPoints(pointsByTeamId, match.awayTeamId, 1)
      continue
    }

    if (result.penaltyShootoutWinnerTeamId === match.awayTeamId) {
      addPoints(pointsByTeamId, match.homeTeamId, 1)
      addPoints(pointsByTeamId, match.awayTeamId, 2)
      continue
    }

    addPoints(pointsByTeamId, match.homeTeamId, 1)
    addPoints(pointsByTeamId, match.awayTeamId, 1)
  }

  return pointsByTeamId
}

function calculateTeamStageBonusPoints(matches: Doc<'matches'>[]) {
  const pointsByTeamId = new Map<Id<'teams'>, number>()
  const awardedStageKeys = new Set<string>()

  for (const match of matches) {
    const stagePoints = stageBonusPointsByStage.get(match.stage)

    if (stagePoints === undefined) {
      continue
    }

    for (const teamId of [match.homeTeamId, match.awayTeamId]) {
      if (teamId === null) {
        continue
      }

      const stageKey = `${teamId}:${match.stage}`

      if (awardedStageKeys.has(stageKey)) {
        continue
      }

      awardedStageKeys.add(stageKey)
      addPoints(pointsByTeamId, teamId, stagePoints)
    }
  }

  return pointsByTeamId
}

function calculateTeamWinnerBonusPoints(
  matches: Doc<'matches'>[],
  resultsByMatchId: Map<Id<'matches'>, Doc<'matchResults'>>,
) {
  const pointsByTeamId = new Map<Id<'teams'>, number>()

  for (const match of matches) {
    if (match.stage !== 'Final') {
      continue
    }

    const result = resultsByMatchId.get(match._id)
    const winnerTeamId = result === undefined ? null : getWinnerTeamId(match, result)

    if (winnerTeamId !== null) {
      addPoints(pointsByTeamId, winnerTeamId, worldCupWinnerBonus)
    }
  }

  return pointsByTeamId
}

function calculateGoalsByPlayerId(goals: Doc<'matchGoals'>[]) {
  const goalsByPlayerId = new Map<Id<'eligiblePlayers'>, number>()

  for (const goal of goals) {
    if (goal.isOwnGoal) {
      continue
    }

    addPoints(goalsByPlayerId, goal.creditedPlayerId, 1)
  }

  return goalsByPlayerId
}

function getWinnerTeamId(match: Doc<'matches'>, result: Doc<'matchResults'>) {
  if (match.homeTeamId === null || match.awayTeamId === null) {
    return null
  }

  if (result.homeGoals > result.awayGoals) {
    return match.homeTeamId
  }

  if (result.awayGoals > result.homeGoals) {
    return match.awayTeamId
  }

  if (
    result.penaltyShootoutWinnerTeamId === match.homeTeamId ||
    result.penaltyShootoutWinnerTeamId === match.awayTeamId
  ) {
    return result.penaltyShootoutWinnerTeamId
  }

  return null
}

function getTierMultiplier(tier: Doc<'teamTiers'> | undefined) {
  return tier?.multiplier ?? 1
}

function addPoints<TKey>(pointsByKey: Map<TKey, number>, key: TKey, points: number) {
  pointsByKey.set(key, (pointsByKey.get(key) ?? 0) + points)
}

function groupByEntry<T extends { entryId: Id<'entries'> }>(rows: T[]) {
  const byEntryId = new Map<Id<'entries'>, T[]>()

  for (const row of rows) {
    byEntryId.set(row.entryId, [...(byEntryId.get(row.entryId) ?? []), row])
  }

  return byEntryId
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000
}
