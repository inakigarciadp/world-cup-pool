import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CalendarClock, ListChecks, LogOut, Shield, Trophy } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SESSION_STORAGE_KEY = 'world-cup-pool-session'

type ProtectedRoute = 'leaderboard' | 'entries' | 'setup'
type Overview = NonNullable<FunctionReturnType<typeof api.pools.getAuthenticatedOverview>>

function App() {
  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <LoginShell>
          <p className="text-sm text-muted-foreground">Set VITE_CONVEX_URL to enable participant login.</p>
          <code className="block rounded-md border bg-muted px-3 py-2 text-xs">pnpm dev:convex</code>
        </LoginShell>
      </main>
    )
  }

  return <ConnectedApp />
}

function ConnectedApp() {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(SESSION_STORAGE_KEY))
  const [route, setRoute] = useState<ProtectedRoute>(() => getRouteFromHash())
  const overview = useQuery(
    api.pools.getAuthenticatedOverview,
    sessionToken === null ? 'skip' : { sessionToken },
  )
  const logout = useMutation(api.pools.logout)

  useEffect(() => {
    const syncRoute = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (overview === null) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [overview])

  async function handleLogout() {
    if (sessionToken !== null) {
      await logout({ sessionToken })
    }

    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSessionToken(null)
    window.location.hash = ''
  }

  if (sessionToken === null) {
    return <LoginScreen onLogin={setSessionToken} />
  }

  if (overview === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <p className="text-sm text-muted-foreground">Loading pool...</p>
      </main>
    )
  }

  if (overview === null) {
    return <LoginScreen onLogin={setSessionToken} />
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Trophy className="size-4" aria-hidden="true" />
              {overview.pool.name}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Pool Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RouteButton route="leaderboard" activeRoute={route} label="Leaderboard" />
            <RouteButton route="entries" activeRoute={route} label="Entries" />
            <RouteButton route="setup" activeRoute={route} label="Setup" />
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4" aria-hidden="true" />
                Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{overview.session.participantName}</p>
              <p className="text-muted-foreground">{overview.session.isAdmin ? 'Admin participant' : 'Participant'}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden="true" />
                Entry Lock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(overview.pool.entryLockAt)}</p>
              <p className="text-muted-foreground capitalize">{overview.pool.status}</p>
            </CardContent>
          </Card>
        </aside>

        {route === 'leaderboard' ? <Leaderboard overview={overview} /> : null}
        {route === 'entries' ? <Entries overview={overview} /> : null}
        {route === 'setup' ? <Setup overview={overview} /> : null}
      </div>
    </main>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [loginName, setLoginName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const login = useMutation(api.pools.login)
  const seedDemoPool = useMutation(api.pools.seedDemoPool)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const session = await login({ loginName, pin })
      localStorage.setItem(SESSION_STORAGE_KEY, session.token)
      onLogin(session.token)
      window.location.hash = '#leaderboard'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSeedDemoPool() {
    setError(null)
    await seedDemoPool({})
    setLoginName('ana')
    setPin('pool')
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
      <LoginShell>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Participant name</span>
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
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
        <Button className="w-full" type="button" variant="outline" onClick={handleSeedDemoPool}>
          Create demo pool
        </Button>
      </LoginShell>
    </main>
  )
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <section className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-md border bg-card">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">World Cup Pool</h1>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-2">{children}</CardContent>
      </Card>
    </section>
  )
}

function RouteButton({ route, activeRoute, label }: { route: ProtectedRoute; activeRoute: ProtectedRoute; label: string }) {
  return (
    <Button
      type="button"
      variant={route === activeRoute ? 'default' : 'outline'}
      onClick={() => {
        window.location.hash = route
      }}
    >
      {label}
    </Button>
  )
}

function Leaderboard({ overview }: { overview: Overview }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Participants" value={overview.counts.participants} />
        <Metric label="Entries" value={overview.counts.entries} />
        <Metric label="Teams" value={overview.counts.teams} />
        <Metric label="Goalscorers" value={overview.counts.eligiblePlayers} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" aria-hidden="true" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {overview.leaderboard.map((entry, index) => (
              <div key={entry.entryId} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-3 text-sm">
                <span className="text-muted-foreground">{index + 1}</span>
                <span className="font-medium">{entry.participantName}</span>
                <span className="font-semibold">{entry.currentScore} pts</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function Entries({ overview }: { overview: Overview }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {overview.leaderboard.map((entry) => (
        <Card key={entry.entryId}>
          <CardHeader>
            <CardTitle>{entry.participantName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Goalscorer Pick</p>
              <p className="font-medium">{entry.goalscorerPick ?? 'Not selected'}</p>
            </div>
            <div className="space-y-2">
              {entry.teamPicks.map((pick) => (
                <div key={`${entry.entryId}-${pick.tierName}-${pick.teamName}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-muted-foreground">{pick.tierName}</span>
                  <span className="font-medium">{pick.teamName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function Setup({ overview }: { overview: Overview }) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" aria-hidden="true" />
            Team Tiers
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {overview.teamTiers.map((tier) => (
            <div key={tier.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{tier.name}</p>
                <span className="text-muted-foreground">{tier.requiredPicks} picks</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tier.teams.map((team) => (
                  <span key={team.id} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {team.fifaCode}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Stage Bonuses</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          {overview.stageBonuses.map((bonus) => (
            <div key={bonus.id} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{bonus.stage}</p>
              <p className="text-muted-foreground">{bonus.points} points</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function getRouteFromHash(): ProtectedRoute {
  const hash = window.location.hash.replace('#', '')
  return hash === 'entries' || hash === 'setup' ? hash : 'leaderboard'
}

export default App
