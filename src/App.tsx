import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { CalendarClock, LogOut, Shield, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getOverview, login, logout, type Overview } from '@/lib/httpApi'
import { OverviewContext } from '@/lib/overview-context'
import { getPoolStatusLabel } from '@/lib/pool'

export function App() {
  if (!import.meta.env.VITE_CONVEX_URL || !import.meta.env.VITE_CONVEX_SITE_URL) {
    return (
      <main className="app-surface flex min-h-svh items-center justify-center px-5 text-foreground">
        <LoginShell>
          <p className="text-sm text-muted-foreground">
            Configura VITE_CONVEX_URL y VITE_CONVEX_SITE_URL para activar el acceso de
            participantes.
          </p>
          <code className="block rounded-md border bg-muted px-3 py-2 text-xs">
            pnpm dev:convex
          </code>
        </LoginShell>
      </main>
    )
  }

  return <ConnectedApp />
}

function ConnectedApp() {
  const [overview, setOverview] = useState<Overview | null | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    let isCurrent = true

    async function loadOverview() {
      try {
        const nextOverview = await getOverview()

        if (isCurrent) {
          setOverview(nextOverview)
        }
      } catch {
        if (isCurrent) {
          setOverview(null)
        }
      }
    }

    void loadOverview()

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleLogout() {
    await logout()
    setOverview(null)
    await navigate({ to: '/' })
  }

  if (overview === null) {
    return <LoginScreen onLogin={setOverview} />
  }

  if (overview === undefined) {
    return (
      <main className="app-surface flex min-h-svh items-center justify-center px-5 text-foreground">
        <p className="text-sm text-muted-foreground">Cargando porra...</p>
      </main>
    )
  }

  return (
    <OverviewContext.Provider value={{ overview, setOverview }}>
      <main className="app-surface min-h-svh text-foreground">
        <header className="top-bar">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Trophy className="size-4" aria-hidden="true" />
                {overview.pool.name}
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">
                Panel de la porra
              </h1>
            </div>
            <div className="nav-strip flex flex-wrap items-center gap-1">
              <NavLink to="/" label="Clasificación" />
              <NavLink to="/entries" label="Apuestas" />
              <NavLink to="/setup" label="Configuración" />
              <Button className="ml-1" type="button" variant="ghost" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden="true" />
                Salir
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[220px_1fr]">
          <aside className="info-rail space-y-6">
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                <Shield className="size-4" aria-hidden="true" />
                Sesión
              </h2>
              <div className="space-y-1 text-sm">
                <p className="text-lg font-black">{overview.session.participantName}</p>
                <p className="text-muted-foreground">
                  {overview.session.isAdmin ? 'Participante administrador' : 'Participante'}
                </p>
              </div>
            </section>
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden="true" />
                Cierre de apuestas
              </h2>
              <div className="space-y-1 text-sm">
                <p className="font-bold">
                  {new Intl.DateTimeFormat('es-ES', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(overview.pool.entryLockAt)}
                </p>
                <p className="text-muted-foreground">{getPoolStatusLabel(overview.pool.status)}</p>
              </div>
            </section>
          </aside>

          <Outlet />
        </div>
      </main>
    </OverviewContext.Provider>
  )
}

function NavLink({ to, label }: { to: '/' | '/entries' | '/setup'; label: string }) {
  return (
    <Link
      to={to}
      className="nav-button inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
      activeProps={{ className: 'is-active' }}
      activeOptions={{ exact: to === '/' }}
    >
      {label}
    </Link>
  )
}

function LoginScreen({ onLogin }: { onLogin: (overview: Overview) => void }) {
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
      await login(loginName, pin)
      const overview = await getOverview()

      if (overview === null) {
        throw new Error('No se ha podido iniciar la sesión.')
      }

      onLogin(overview)
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

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <section className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-11 rotate-[-4deg] items-center justify-center rounded-lg border-2 border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-black tracking-normal">Porra del Mundial</h1>
      </div>
      <Card className="login-card">
        <CardContent className="space-y-4 pt-2">{children}</CardContent>
      </Card>
    </section>
  )
}
