#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { getAdminScriptSecret, getConvexDeployment } from './admin-script-secret.mjs'

const FIFA_WEB_ORIGIN = 'https://www.fifa.com'
const FIFA_CONTENT_API_BASE_URL = 'https://cxm-api.fifa.com/fifaplusweb/api'
const FIFA_FDCP_API_BASE_URL = 'https://api.fifa.com/api/v3'
const FIFA_WORLD_CUP_COMPETITION_ID = '17'
const FIFA_WORLD_CUP_SEASON_ID = '285023'
const FIFA_SQUAD_INDEX_PATH =
  '/en/tournaments/mens/worldcup/canadamexicousa2026/articles/all-world-cup-squad-announcements'

const teams = [
  ['MEX', ['mexico', 'méxico']],
  ['RSA', ['south-africa', 'sudafrica', 'sudáfrica']],
  ['KOR', ['korea-republic', 'south-korea', 'corea-del-sur']],
  ['CZE', ['czechia', 'chequia']],
  ['CAN', ['canada', 'canadá']],
  ['SUI', ['switzerland', 'suiza']],
  ['QAT', ['qatar', 'catar']],
  ['BIH', ['bosnia-and-herzegovina', 'bosnia-y-herzegovina']],
  ['BRA', ['brazil', 'brasil']],
  ['MAR', ['morocco', 'marruecos']],
  ['HAI', ['haiti', 'haití']],
  ['SCO', ['scotland', 'escocia']],
  ['USA', ['united-states', 'usa', 'estados-unidos']],
  ['PAR', ['paraguay']],
  ['AUS', ['australia']],
  ['TUR', ['turkiye', 'turkey', 'turquía', 'turquia']],
  ['GER', ['germany', 'alemania']],
  ['CUW', ['curacao', 'curaçao', 'curazao']],
  ['CIV', ['cote-divoire', 'cote-d-ivoire', 'ivory-coast', 'costa-de-marfil']],
  ['ECU', ['ecuador']],
  ['NED', ['netherlands', 'paises-bajos', 'países-bajos']],
  ['JPN', ['japan', 'japón', 'japon']],
  ['TUN', ['tunisia', 'túnez', 'tunez']],
  ['SWE', ['sweden', 'suecia']],
  ['BEL', ['belgium', 'bélgica', 'belgica']],
  ['EGY', ['egypt', 'egipto']],
  ['IRN', ['iran', 'irán']],
  ['NZL', ['new-zealand', 'nueva-zelanda']],
  ['ESP', ['spain', 'españa', 'espana']],
  ['CPV', ['cape-verde', 'cabo-verde']],
  ['KSA', ['saudi-arabia', 'arabia-saudi', 'arabia-saudí']],
  ['URU', ['uruguay']],
  ['FRA', ['france', 'francia']],
  ['SEN', ['senegal']],
  ['IRQ', ['iraq', 'irak']],
  ['NOR', ['norway', 'noruega']],
  ['ARG', ['argentina']],
  ['ALG', ['algeria', 'argelia']],
  ['AUT', ['austria']],
  ['JOR', ['jordan', 'jordania']],
  ['POR', ['portugal']],
  ['UZB', ['uzbekistan', 'uzbekistán']],
  ['COL', ['colombia']],
  ['COD', ['dr-congo', 'congo-dr', 'rd-congo']],
  ['ENG', ['england', 'inglaterra']],
  ['CRO', ['croatia', 'croacia']],
  ['GHA', ['ghana']],
  ['PAN', ['panama', 'panamá']],
]

const options = parseArgs(process.argv.slice(2))

if (!options.dryRun && options.deployment !== 'dev' && options.deployment !== 'prod') {
  console.error('Usage: pnpm players:import:fifa:dev OR pnpm players:import:fifa:prod')
  console.error('Optional: -- --slug <pool-slug>')
  console.error('Dry run: pnpm players:import:fifa')
  process.exit(1)
}

const players = options.input
  ? JSON.parse(await readFile(options.input, 'utf8'))
  : await fetchFifaPlayers(options.limit)

if (players.length === 0) {
  fail('No players were extracted. FIFA may have changed the page structure.')
}

const byTeam = new Map()
for (const player of players) {
  byTeam.set(player.teamFifaCode, (byTeam.get(player.teamFifaCode) ?? 0) + 1)
}

console.log(`Extracted ${players.length} eligible players from ${byTeam.size} teams.`)
console.table(
  [...byTeam.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([teamFifaCode, count]) => ({ teamFifaCode, count })),
)

if (options.dryRun) {
  process.exit(0)
}

const args = {
  scriptSecret: await getAdminScriptSecret(options.deployment),
  slug: options.slug,
  players,
}
const convexDeployment = await getConvexDeployment(options.deployment)
const convexArgs = [
  'exec',
  'convex',
  'run',
  'pools:importEligiblePlayersForAdmin',
  JSON.stringify(args),
  '--deployment',
  convexDeployment,
  ...(options.deployment === 'dev' ? ['--push'] : []),
]

const result = spawnSync('pnpm', convexArgs, { stdio: 'inherit' })
process.exit(result.status ?? 1)

async function fetchFifaPlayers(limit) {
  const officialPlayersByTeamCode = await fetchOfficialSquadPlayers(limit)
  const missingTeamCodes = new Set(selectedTeams(limit).map(([teamFifaCode]) => teamFifaCode))

  for (const teamFifaCode of officialPlayersByTeamCode.keys()) {
    missingTeamCodes.delete(teamFifaCode)
  }

  if (missingTeamCodes.size > 0) {
    console.warn(
      `FIFA squad endpoint had no players for ${missingTeamCodes.size} teams; falling back to squad announcement articles.`,
    )
  }

  const players = [...officialPlayersByTeamCode.values()].flat()
  const announcementPlayers = await fetchSquadAnnouncementPlayers(missingTeamCodes)

  for (const player of announcementPlayers) {
    players.push(player)
  }

  return uniquePlayers(players)
}

async function fetchOfficialSquadPlayers(limit) {
  const teamIdsByCode = await fetchWorldCupTeamIds()
  const playersByTeamCode = new Map()

  for (const [teamFifaCode] of selectedTeams(limit)) {
    const teamId = teamIdsByCode.get(teamFifaCode)

    if (teamId === undefined) {
      continue
    }

    const params = new URLSearchParams({
      idCompetition: FIFA_WORLD_CUP_COMPETITION_ID,
      idSeason: FIFA_WORLD_CUP_SEASON_ID,
      language: 'en',
    })
    const squad = await fetchJson(
      `${FIFA_FDCP_API_BASE_URL}/teams/${teamId}/squad?${params.toString()}`,
    )
    const players = extractOfficialSquadPlayers(squad, teamFifaCode)

    if (players.length > 0) {
      playersByTeamCode.set(teamFifaCode, players)
    }
  }

  return playersByTeamCode
}

async function fetchWorldCupTeamIds() {
  const params = new URLSearchParams({
    language: 'en',
    count: '500',
    idSeason: FIFA_WORLD_CUP_SEASON_ID,
  })
  const calendar = await fetchJson(
    `${FIFA_FDCP_API_BASE_URL}/calendar/matches?${params.toString()}`,
  )
  const teamsByCode = new Map()

  for (const match of calendar.Results ?? []) {
    for (const side of [match.Home, match.Away]) {
      const teamFifaCode = (
        side?.Abbreviation ??
        side?.IdCountry ??
        side?.IdAssociation ??
        ''
      ).toUpperCase()

      if (teamFifaCode && side?.IdTeam) {
        teamsByCode.set(teamFifaCode, side.IdTeam)
      }
    }
  }

  return teamsByCode
}

function extractOfficialSquadPlayers(squad, teamFifaCode) {
  const players = []

  for (const player of squad?.Players ?? []) {
    const name = cleanPlayerName(
      localizedDescription(player.DisplayName) ??
        localizedDescription(player.KnownName) ??
        localizedDescription(player.ShortName) ??
        localizedDescription(player.Name) ??
        [localizedDescription(player.FirstName), localizedDescription(player.LastName)]
          .filter(Boolean)
          .join(' '),
    )

    if (isLikelyPlayerName(name)) {
      players.push({ name, teamFifaCode })
    }
  }

  return players
}

async function fetchSquadAnnouncementPlayers(teamCodes) {
  if (teamCodes.size === 0) {
    return []
  }

  const indexPage = await fetchContentPage(FIFA_SQUAD_INDEX_PATH)
  const indexArticle = await fetchArticleSection(indexPage)
  const links = extractSquadAnnouncementLinks(indexArticle).filter((link) =>
    teamCodes.has(link.teamFifaCode),
  )
  const players = []

  for (const link of links) {
    try {
      const page = await fetchContentPage(link.uri)
      const article = await fetchArticleSection(page)
      const names = extractPlayerNamesFromArticle(article)

      for (const name of names) {
        players.push({ name, teamFifaCode: link.teamFifaCode })
      }
    } catch (error) {
      console.warn(`Skipped ${link.uri}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return players
}

async function fetchContentPage(pathOrUrl) {
  const path = toFifaPagePath(pathOrUrl)
  return await fetchJson(`${FIFA_CONTENT_API_BASE_URL}/pages${path}`)
}

async function fetchArticleSection(page) {
  const section = page.sections?.find((section) => section.entryType === 'article')

  if (section === undefined) {
    throw new Error(
      `No article section found for ${page.relativeUrl ?? page.pageId ?? 'FIFA page'}`,
    )
  }

  return await fetchJson(toContentApiUrl(section.entryEndpoint))
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      origin: FIFA_WEB_ORIGIN,
      'user-agent': 'world-cup-pool-admin-import/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return await response.json()
}

function inferTeamFifaCode(url) {
  const normalizedUrl = normalize(url)

  for (const [fifaCode, aliases] of teams) {
    if (aliases.some((alias) => normalizedUrl.includes(normalize(alias)))) {
      return fifaCode
    }
  }

  return null
}

function extractSquadAnnouncementLinks(article) {
  const links = []

  for (const link of collectHyperlinks(article.richtext)) {
    if (!isSquadAnnouncementLink(link)) {
      continue
    }

    const teamFifaCode =
      inferTeamFifaCode(link.text) ?? inferTeamFifaCode(link.uri.replace('canadamexicousa2026', ''))

    if (teamFifaCode === null || links.some((existing) => existing.teamFifaCode === teamFifaCode)) {
      continue
    }

    links.push({ ...link, teamFifaCode })
  }

  return links
}

function collectHyperlinks(node, links = []) {
  if (node?.nodeType === 'hyperlink') {
    links.push({
      uri: node.data?.uri ?? '',
      text: richTextPlainText(node),
    })
  }

  for (const child of node?.content ?? []) {
    collectHyperlinks(child, links)
  }

  return links
}

function isSquadAnnouncementLink(link) {
  return (
    normalize(link.uri).includes('articles') &&
    normalize(`${link.uri} ${link.text}`).includes('squad') &&
    !normalize(link.uri).includes('all-world-cup-squad-announcements')
  )
}

function extractPlayerNamesFromArticle(article) {
  const names = []
  let readingSquadSection = false

  for (const node of article.richtext?.content ?? []) {
    const text = richTextPlainText(node)

    if (node.nodeType === 'hr') {
      readingSquadSection = false
      continue
    }

    if (node.nodeType?.startsWith('heading-')) {
      readingSquadSection = isSquadPositionHeading(text)
      continue
    }

    if (!readingSquadSection) {
      continue
    }

    for (const name of splitPlayerNames(text)) {
      if (isLikelyPlayerName(name)) {
        names.push(name)
      }
    }
  }

  return [...new Set(names)].sort((left, right) => left.localeCompare(right))
}

function richTextPlainText(node) {
  if (node?.nodeType === 'text') {
    return node.value ?? ''
  }

  return (node?.content ?? []).map(richTextPlainText).join('')
}

function splitPlayerNames(value) {
  return value.split(/\n+/).map(cleanPlayerName).filter(Boolean)
}

function isSquadPositionHeading(value) {
  return [
    'goalkeeper',
    'goalkeepers',
    'defender',
    'defenders',
    'midfielder',
    'midfielders',
    'forward',
    'forwards',
  ].includes(normalize(value))
}

function toFifaPagePath(pathOrUrl) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return new URL(pathOrUrl).pathname
  }

  if (pathOrUrl.startsWith('fifa.com/')) {
    return new URL(`https://${pathOrUrl}`).pathname
  }

  if (pathOrUrl.startsWith('/')) {
    return pathOrUrl
  }

  return `/${pathOrUrl}`
}

function toContentApiUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }

  if (endpoint.startsWith('/')) {
    return `${FIFA_CONTENT_API_BASE_URL}${endpoint}`
  }

  return `${FIFA_CONTENT_API_BASE_URL}/${endpoint}`
}

function cleanPlayerName(rawName) {
  return String(rawName ?? '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\s+\([^)]*\)$/, '')
    .trim()
}

function localizedDescription(value) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return (
      value.find((entry) => entry.Locale?.startsWith('en'))?.Description ?? value[0]?.Description
    )
  }

  return value?.Description
}

function isLikelyPlayerName(name) {
  const rejected = [
    'FIFA World Cup',
    'World Cup',
    'Privacy Policy',
    'Terms of Service',
    'Squad Announcement',
    'Squad List',
    'Head Coach',
    'Goalkeepers',
    'Defenders',
    'Midfielders',
    'Forwards',
  ]

  return (
    name.length >= 3 &&
    name.length <= 80 &&
    !rejected.some((value) => normalize(name).includes(normalize(value))) &&
    /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.\-\s]+$/.test(name)
  )
}

function uniquePlayers(players) {
  const seen = new Set()
  const unique = []

  for (const player of players) {
    const key = `${player.teamFifaCode}:${normalize(player.name)}`

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(player)
    }
  }

  return unique
}

function parseArgs(argv) {
  const parsed = {
    slug: 'world-cup-2026',
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--') {
      continue
    } else if (arg === '--slug') {
      parsed.slug = next
      index += 1
    } else if (arg === '--deployment') {
      parsed.deployment = next
      index += 1
    } else if (arg === '--input') {
      parsed.input = next
      index += 1
    } else if (arg === '--limit') {
      parsed.limit = Number(next)
      index += 1
    } else if (arg === '--dry-run') {
      parsed.dryRun = true
    } else {
      fail(`Unknown argument: ${arg}`)
    }
  }

  return parsed
}

function selectedTeams(limit) {
  return typeof limit === 'number' ? teams.slice(0, limit) : teams
}

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
