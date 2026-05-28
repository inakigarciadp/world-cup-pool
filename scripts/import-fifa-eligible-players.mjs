#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const FIFA_SQUAD_INDEX_URL =
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/all-world-cup-squad-announcements'

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
  ['CIV', ['cote-divoire', 'ivory-coast', 'costa-de-marfil']],
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
console.table([...byTeam.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([teamFifaCode, count]) => ({ teamFifaCode, count })))

if (options.dryRun) {
  process.exit(0)
}

const args = {
  slug: options.slug,
  players,
}
const convexArgs = ['convex', 'run', 'pools:importEligiblePlayersForAdmin', '--args', JSON.stringify(args)]

if (options.deployment) {
  convexArgs.push('--deployment', options.deployment)
}

const result = spawnSync('npx', convexArgs, { stdio: 'inherit' })
process.exit(result.status ?? 1)

async function fetchFifaPlayers(limit) {
  const indexHtml = await fetchText(FIFA_SQUAD_INDEX_URL)
  const articleUrls = extractArticleUrls(indexHtml)
  const selectedUrls = typeof limit === 'number' ? articleUrls.slice(0, limit) : articleUrls
  const players = []

  for (const url of selectedUrls) {
    const teamFifaCode = inferTeamFifaCode(url)

    if (teamFifaCode === null) {
      continue
    }

    try {
      const html = await fetchText(url)
      const names = extractPlayerNames(html)

      for (const name of names) {
        players.push({ name, teamFifaCode })
      }
    } catch (error) {
      console.warn(`Skipped ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return uniquePlayers(players)
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'world-cup-pool-admin-import/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return await response.text()
}

function extractArticleUrls(html) {
  const urls = new Set()
  const hrefPattern = /href=["']([^"']*squad-announcement[^"']*)["']/gi
  let match

  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1].replace(/\\u002F/g, '/')
    urls.add(new URL(href, 'https://www.fifa.com').toString())
  }

  if (urls.size > 0) {
    return [...urls].sort()
  }

  return teams.flatMap(([, aliases]) =>
    aliases.slice(0, 2).map((alias) => new URL(`${alias}-squad-announcement`, FIFA_SQUAD_INDEX_URL.replace('all-world-cup-squad-announcements', '')).toString()),
  )
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

function extractPlayerNames(html) {
  const decoded = html
    .replace(/\\u002F/g, '/')
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
  const names = new Set()
  const jsonNamePattern = /"(?:displayName|fullName|name|title)"\s*:\s*"([^"]{3,80})"/g
  const textNamePattern = />\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){1,4})\s*</g
  let match

  while ((match = jsonNamePattern.exec(decoded)) !== null) {
    addName(names, match[1])
  }

  while ((match = textNamePattern.exec(decoded)) !== null) {
    addName(names, match[1])
  }

  return [...names].sort((left, right) => left.localeCompare(right))
}

function addName(names, rawName) {
  const name = rawName.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()

  if (!isLikelyPlayerName(name)) {
    return
  }

  names.add(name)
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
    !rejected.some((value) => normalize(name).includes(normalize(value))) &&
    /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){1,4}$/.test(name)
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

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
