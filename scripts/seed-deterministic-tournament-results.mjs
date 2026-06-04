#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { getAdminScriptSecret, getConvexDeployment } from './admin-script-secret.mjs'

const options = parseArgs(process.argv.slice(2))

if (options.deployment !== 'dev') {
  console.error('Uso: pnpm matches:seed-results:dev')
  console.error('Opcional: -- --seed <semilla> --slug <slug-porra> --no-confirm-top-scorers')
  process.exit(1)
}

const args = {
  scriptSecret: await getAdminScriptSecret(options.deployment),
  slug: options.slug,
  seed: options.seed,
  confirmTopScorers: options.confirmTopScorers,
}
const convexDeployment = await getConvexDeployment(options.deployment)
const convexArgs = [
  'exec',
  'convex',
  'run',
  'matches:seedDeterministicTournamentResultsForAdmin',
  JSON.stringify(args),
  '--deployment',
  convexDeployment,
  '--push',
]

const result = spawnSync('pnpm', convexArgs, { stdio: 'inherit' })
process.exit(result.status ?? 1)

function parseArgs(args) {
  const options = {
    deployment: null,
    slug: undefined,
    seed: undefined,
    confirmTopScorers: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--deployment') {
      options.deployment = args[index + 1] ?? null
      index += 1
      continue
    }

    if (arg === '--slug') {
      options.slug = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--seed') {
      options.seed = args[index + 1]
      index += 1
      continue
    }

    if (arg === '--no-confirm-top-scorers') {
      options.confirmTopScorers = false
    }
  }

  return options
}
