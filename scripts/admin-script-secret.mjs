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

export async function getConvexDeployment(deployment) {
  await loadEnvFile('.env.local')

  if (deployment === 'dev') {
    const configured = process.env.CONVEX_DEPLOYMENT

    if (!configured) {
      console.error('CONVEX_DEPLOYMENT is required in .env.local to run dev scripts.')
      process.exit(1)
    }

    return configured.startsWith('dev:') ? configured.slice('dev:'.length) : configured
  }

  return process.env.CONVEX_PROD_DEPLOYMENT || 'prod'
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
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }

    process.env[key] ??= value
  }
}
