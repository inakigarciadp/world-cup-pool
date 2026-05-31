import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { LoginShell } from '@/App'
import { Button } from '@/components/ui/button'
import { loginSession } from '@/lib/auth-session'

export function LoginPage() {
  const [loginName, setLoginName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await loginSession(loginName, pin)
      await navigate({ to: '/' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido iniciar la sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-surface flex min-h-svh items-center justify-center px-5 text-foreground">
      <LoginShell>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Nombre de participante</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring/40 focus:ring-3"
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>PIN</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring/40 focus:ring-3"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </LoginShell>
    </main>
  )
}
