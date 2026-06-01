import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { LoginShell } from '@/App'
import { loginSession } from '@/lib/auth-session'

export function LoginPage() {
  const [loginName, setLoginName] = useState('')
  const [pin, setPin] = useState('')
  const navigate = useNavigate()
  const loginMutation = useMutation({
    mutationFn: () => loginSession(loginName, pin),
    onSuccess: async () => {
      await navigate({ to: '/' })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loginMutation.mutate()
  }

  return (
    <LoginShell>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="login-field">
          <label htmlFor="loginName">Nombre de participante</label>
          <input
            id="loginName"
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            autoComplete="username"
            spellCheck={false}
          />
        </div>
        <div className="login-field">
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </div>
        {loginMutation.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'No se ha podido iniciar la sesión.'}
          </p>
        ) : null}
        <button type="submit" className="login-cta" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
        <p className="text-center text-xs font-semibold text-ink-soft">
          Pídele al admin que te dé de alta si aún no tienes nombre.
        </p>
      </form>
    </LoginShell>
  )
}
