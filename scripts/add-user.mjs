import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const CSV_PATH = resolve('data/users.csv')
const HEADER = ['username', 'displayName', 'pin', 'isAdmin']
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const PASSWORD_LENGTH = 25

const args = process.argv.slice(2)
const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
const username = positionalArgs[0]?.trim().toLowerCase()
const displayName = positionalArgs[1]?.trim() || username
const isAdmin = args.includes('--admin')

if (!username) {
  console.error('Usage: pnpm users:add <username> [displayName] [--admin]')
  process.exit(1)
}

if (!/^[a-z0-9._-]+$/.test(username)) {
  console.error(
    'Username may only contain lowercase letters, numbers, dots, underscores, and hyphens.',
  )
  process.exit(1)
}

const rows = await readUsers()

if (rows.some((row) => row.username === username)) {
  console.error(`User "${username}" already exists in ${CSV_PATH}.`)
  process.exit(1)
}

const pin = generatePassword()
rows.push({
  username,
  displayName,
  pin,
  isAdmin: String(isAdmin),
})

await writeUsers(rows)

console.log(`Added ${username} to ${CSV_PATH}`)
console.log(`PIN: ${pin}`)

async function readUsers() {
  try {
    const csv = await readFile(CSV_PATH, 'utf8')
    const lines = csv.trim().split(/\r?\n/)

    if (lines.length === 0 || lines[0] !== HEADER.join(',')) {
      throw new Error(`Expected header: ${HEADER.join(',')}`)
    }

    return lines.slice(1).filter(Boolean).map(parseCsvLine)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function writeUsers(rows) {
  await mkdir(dirname(CSV_PATH), { recursive: true })
  const body = [
    HEADER.join(','),
    ...rows.map((row) => HEADER.map((field) => escapeCsv(row[field])).join(',')),
  ].join('\n')

  await writeFile(CSV_PATH, `${body}\n`)
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

function escapeCsv(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

function generatePassword() {
  let password = ''

  while (password.length < PASSWORD_LENGTH) {
    const byte = randomBytes(1)[0]

    if (byte < 248) {
      password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
    }
  }

  return password
}
