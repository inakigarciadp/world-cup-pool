import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'

const CSV_PATH = resolve('data/users.csv')
const HEADER = ['username', 'displayName', 'pin', 'isAdmin']
const PIN_HASH_ITERATIONS = 210_000
const PIN_SALT_BYTES = 16
const PIN_HASH_BYTES = 32

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

  return await Promise.all(
    lines
      .slice(1)
      .filter(Boolean)
      .map(async (line) => {
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
          pinHash: await hashPin(pin),
          isAdmin: row.isAdmin.trim().toLowerCase() === 'true',
        }
      }),
  )
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

async function hashPin(pin) {
  const salt = webcrypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES))
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PIN_HASH_ITERATIONS,
    },
    key,
    PIN_HASH_BYTES * 8,
  )

  return `pbkdf2-sha256$${PIN_HASH_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(bits))}`
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}
