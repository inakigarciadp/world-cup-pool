declare const process: {
  env: Record<string, string | undefined>
}

export function requireAdminScriptSecret(scriptSecret: string) {
  const expected = process.env.ADMIN_SCRIPT_SECRET

  if (!expected || scriptSecret !== expected) {
    throw new Error('No autorizado.')
  }
}
