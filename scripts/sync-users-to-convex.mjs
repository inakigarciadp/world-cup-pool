import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const CSV_PATH = resolve('data/users.csv')
const HEADER = ['username', 'displayName', 'pin', 'isAdmin']

const deployment = getFlagValue('--deployment')
const slug = getFlagValue('--slug') ?? 'world-cup-2026'
const isDryRun = process.argv.includes('--dry-run')

if (deployment !== 'dev' && deployment !== 'prod') {
  console.error('Usage: pnpm users:sync:dev OR pnpm users:sync:prod')
  console.error('Optional: -- --slug <pool-slug>')
  process.exit(1)
}

const users = await readUsers()

if (users.length === 0) {
  console.error(`${CSV_PATH} does not contain any users.`)
  process.exit(1)
}

const args = JSON.stringify({ slug, users })

if (isDryRun) {
  console.log(`Would sync ${users.length} user(s) to ${deployment} deployment for pool "${slug}".`)
  console.log('Existing database participants not present in the CSV are left untouched.')
  process.exit(0)
}

const commandArgs = [
  'exec',
  'convex',
  'run',
  'pools:upsertParticipantsFromCsv',
  args,
  '--deployment',
  deployment,
  '--push',
]

const child = spawn('pnpm', commandArgs, {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Sync interrupted by ${signal}.`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})

async function readUsers() {
  const csv = await readFile(CSV_PATH, 'utf8')
  const lines = csv.trim().split(/\r?\n/)

  if (lines.length === 0 || lines[0] !== HEADER.join(',')) {
    throw new Error(`Expected header: ${HEADER.join(',')}`)
  }

  return lines.slice(1).filter(Boolean).map((line) => {
    const row = parseCsvLine(line)
    const username = row.username.trim().toLowerCase()
    const displayName = row.displayName.trim() || username
    const pin = row.pin.trim()

    if (!/^[a-z0-9._-]+$/.test(username)) {
      throw new Error(`Invalid username "${row.username}".`)
    }

    if (pin.length !== 25) {
      throw new Error(`PIN for "${username}" must be 25 characters.`)
    }

    return {
      username,
      displayName,
      pin,
      isAdmin: row.isAdmin.trim().toLowerCase() === 'true',
    }
  })
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      current += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += character
    }
  }

  values.push(current)

  if (values.length !== HEADER.length) {
    throw new Error(`Invalid CSV row: ${line}`)
  }

  return Object.fromEntries(HEADER.map((field, index) => [field, values[index]]))
}

function getFlagValue(flag) {
  const index = process.argv.indexOf(flag)

  if (index === -1) {
    return null
  }

  return process.argv[index + 1] ?? null
}
