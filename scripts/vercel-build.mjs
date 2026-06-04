import { spawn } from 'node:child_process'

const convexUrl = process.env.VITE_CONVEX_URL

if (!convexUrl) {
  console.error('VITE_CONVEX_URL is required. Run this script through `convex deploy --cmd`.')
  process.exit(1)
}

if (process.env.VERCEL_ENV !== 'production') {
  process.env.VITE_CONVEX_SITE_URL ??= convexUrl.replace('.convex.cloud', '.convex.site')
}

const child = spawn('pnpm', ['build'], {
  env: process.env,
  shell: false,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Build interrupted by ${signal}.`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
