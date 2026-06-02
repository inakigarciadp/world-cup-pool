import { readFile } from 'node:fs/promises'

export async function getAdminScriptSecret(deployment) {
  await loadEnvFile('.env.local')

  const envName =
    deployment === 'prod' ? 'CONVEX_PROD_ADMIN_SCRIPT_SECRET' : 'CONVEX_DEV_ADMIN_SCRIPT_SECRET'
  const secret = process.env[envName]

  if (!secret) {
    console.error(`${envName} is required in .env.local to run this script.`)
    process.exit(1)
  }

  return secret
}

async function loadEnvFile(path) {
  let contents

  try {
    contents = await readFile(path, 'utf8')
  } catch (caught) {
    if (caught?.code === 'ENOENT') {
      return
    }

    throw caught
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')

    if (equalsIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] ??= value
  }
}
