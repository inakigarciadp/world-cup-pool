#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { getAdminScriptSecret, getConvexDeployment } from './admin-script-secret.mjs'

const FIFA_CALENDAR_API_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=500'

const options = parseArgs(process.argv.slice(2))

if (!options.dryRun && options.deployment !== 'dev' && options.deployment !== 'prod') {
  console.error('Usage: pnpm matches:import:fifa:dev OR pnpm matches:import:fifa:prod')
  console.error('Optional: -- --slug <pool-slug>')
  console.error('Dry run: pnpm matches:import:fifa')
  process.exit(1)
}

const matches = options.input
  ? JSON.parse(await readFile(options.input, 'utf8'))
  : await fetchFifaMatches()

if (!Array.isArray(matches) || matches.length === 0) {
  fail('No matches were extracted. FIFA may have changed the calendar payload.')
}

const sortedMatches = matches.toSorted((left, right) => left.matchNumber - right.matchNumber)
const byStage = new Map()

for (const match of sortedMatches) {
  byStage.set(match.stage, (byStage.get(match.stage) ?? 0) + 1)
}

console.log(`Extracted ${sortedMatches.length} World Cup matches.`)
console.table(
  [...byStage.entries()].map(([stage, count]) => ({
    stage,
    count,
  })),
)

if (options.dryRun) {
  process.exit(0)
}

const args = {
  scriptSecret: await getAdminScriptSecret(options.deployment),
  slug: options.slug,
  matches: sortedMatches,
}
const convexDeployment = await getConvexDeployment(options.deployment)
const convexArgs = [
  'exec',
  'convex',
  'run',
  'matches:importFifaMatchesForAdmin',
  JSON.stringify(args),
  '--deployment',
  convexDeployment,
  ...(options.deployment === 'dev' ? ['--push'] : []),
]

const result = spawnSync('pnpm', convexArgs, { stdio: 'inherit' })
process.exit(result.status ?? 1)

async function fetchFifaMatches() {
  const calendar = await fetchJson(FIFA_CALENDAR_API_URL)
  const results = Array.isArray(calendar.Results) ? calendar.Results : []

  return results.map(normalizeFifaMatch).filter(Boolean)
}

function normalizeFifaMatch(match) {
  const matchNumber = Number(match.MatchNumber)
  const kickoffAt = Date.parse(String(match.Date ?? ''))
  const homeTeamFifaCode = normalizeTeamCode(match.Home)
  const awayTeamFifaCode = normalizeTeamCode(match.Away)
  const homePlaceholder =
    cleanText(match.PlaceHolderA) ?? homeTeamFifaCode ?? localizedDescription(match.Home?.TeamName)
  const awayPlaceholder =
    cleanText(match.PlaceHolderB) ?? awayTeamFifaCode ?? localizedDescription(match.Away?.TeamName)
  const venueName = localizedDescription(match.Stadium?.Name)
  const venueCity = localizedDescription(match.Stadium?.CityName)
  const stage = localizedDescription(match.StageName)

  if (
    !Number.isInteger(matchNumber) ||
    !Number.isFinite(kickoffAt) ||
    !homePlaceholder ||
    !awayPlaceholder ||
    !venueName ||
    !venueCity ||
    !stage
  ) {
    return null
  }

  return {
    fifaMatchId: String(match.IdMatch ?? matchNumber),
    matchNumber,
    stage,
    groupName: localizedDescription(match.GroupName),
    kickoffAt,
    venueName,
    venueCity,
    homePlaceholder,
    awayPlaceholder,
    homeTeamFifaCode,
    awayTeamFifaCode,
    source: 'fifa-official-calendar',
    sourceUrl: FIFA_CALENDAR_API_URL,
    sourceUpdatedAt: Date.now(),
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'world-cup-pool-match-import/1.0',
    },
  })

  if (!response.ok) {
    fail(`FIFA request failed with ${response.status}: ${url}`)
  }

  return await response.json()
}

function localizedDescription(value) {
  if (!Array.isArray(value)) {
    return null
  }

  const preferred =
    value.find((entry) => entry?.Locale === 'en-GB') ??
    value.find((entry) => typeof entry?.Description === 'string')

  return cleanText(preferred?.Description)
}

function normalizeTeamCode(side) {
  const code = cleanText(side?.Abbreviation ?? side?.IdCountry ?? side?.IdAssociation)

  return code ? code.toUpperCase() : null
}

function cleanText(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseArgs(args) {
  const options = {
    deployment: null,
    dryRun: true,
    input: null,
    slug: undefined,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--deployment') {
      options.deployment = args[index + 1] ?? null
      options.dryRun = false
      index += 1
      continue
    }

    if (arg === '--input') {
      options.input = args[index + 1] ?? null
      index += 1
      continue
    }

    if (arg === '--slug') {
      options.slug = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
  }

  return options
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
