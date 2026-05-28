import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CalendarClock, Check, ListChecks, LogOut, Save, Search, Shield, Trophy } from 'lucide-react'
import { useMutation } from 'convex/react'

import { api } from '../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { getOverview, login, logout, saveEntry, type Overview } from '@/lib/httpApi'

type ProtectedRoute = 'leaderboard' | 'entries' | 'setup'

function App() {
  if (!import.meta.env.VITE_CONVEX_URL || !import.meta.env.VITE_CONVEX_SITE_URL) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <LoginShell>
          <p className="text-sm text-muted-foreground">Configura VITE_CONVEX_URL y VITE_CONVEX_SITE_URL para activar el acceso de participantes.</p>
          <code className="block rounded-md border bg-muted px-3 py-2 text-xs">pnpm dev:convex</code>
        </LoginShell>
      </main>
    )
  }

  return <ConnectedApp />
}

function ConnectedApp() {
  const [overview, setOverview] = useState<Overview | null | undefined>(undefined)
  const [route, setRoute] = useState<ProtectedRoute>(() => getRouteFromHash())

  useEffect(() => {
    const syncRoute = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

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
    window.location.hash = ''
  }

  if (overview === null) {
    return <LoginScreen onLogin={setOverview} />
  }

  if (overview === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <p className="text-sm text-muted-foreground">Cargando porra...</p>
      </main>
    )
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
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Panel de la porra</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RouteButton route="leaderboard" activeRoute={route} label="Clasificación" />
            <RouteButton route="entries" activeRoute={route} label="Apuestas" />
            <RouteButton route="setup" activeRoute={route} label="Configuración" />
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" aria-hidden="true" />
              Salir
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
                Sesión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{overview.session.participantName}</p>
              <p className="text-muted-foreground">{overview.session.isAdmin ? 'Participante administrador' : 'Participante'}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden="true" />
                Cierre de apuestas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(overview.pool.entryLockAt)}</p>
              <p className="text-muted-foreground">{getPoolStatusLabel(overview.pool.status)}</p>
            </CardContent>
          </Card>
        </aside>

        {route === 'leaderboard' ? <Leaderboard overview={overview} /> : null}
        {route === 'entries' ? <Entries overview={overview} onOverviewChange={setOverview} /> : null}
        {route === 'setup' ? <Setup overview={overview} /> : null}
      </div>
    </main>
  )
}

function LoginScreen({ onLogin }: { onLogin: (overview: Overview) => void }) {
  const [loginName, setLoginName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const seedDemoPool = useMutation(api.pools.seedDemoPool)

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
      window.location.hash = '#leaderboard'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido iniciar la sesión.')
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
        <Button className="w-full" type="button" variant="outline" onClick={handleSeedDemoPool}>
          Crear porra de prueba
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
        <h1 className="text-2xl font-semibold tracking-normal">Porra del Mundial</h1>
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
        <Metric label="Participantes" value={overview.counts.participants} />
        <Metric label="Apuestas" value={overview.counts.entries} />
        <Metric label="Equipos" value={overview.counts.teams} />
        <Metric label="Goleadores" value={overview.counts.eligiblePlayers} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" aria-hidden="true" />
            Clasificación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {overview.leaderboard.map((entry, index) => (
              <div key={entry.entryId} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-3 text-sm">
                <span className="text-muted-foreground">{index + 1}</span>
                <span className="font-medium">{entry.participantName}</span>
                <span className="font-semibold">{entry.currentScore} pts.</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function Entries({ overview, onOverviewChange }: { overview: Overview; onOverviewChange: (overview: Overview) => void }) {
  return (
    <section className="space-y-5">
      <EntryEditor overview={overview} onOverviewChange={onOverviewChange} />
      <div className="grid gap-4 md:grid-cols-2">
        {overview.leaderboard.map((entry) => (
          <Card key={entry.entryId}>
            <CardHeader>
              <CardTitle>{entry.participantName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Goleador elegido</p>
                <p className="font-medium">{entry.goalscorerPick ?? 'Sin elegir'}</p>
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
      </div>
    </section>
  )
}

function EntryEditor({ overview, onOverviewChange }: { overview: Overview; onOverviewChange: (overview: Overview) => void }) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(overview.currentEntry?.teamPickIds ?? [])
  const [goalscorerPickId, setGoalscorerPickId] = useState(overview.currentEntry?.goalscorerPickId ?? '')
  const [goalscorerSearch, setGoalscorerSearch] = useState('')
  const [showTournamentGroups, setShowTournamentGroups] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const isLocked = overview.pool.status !== 'open' || overview.pool.entryLockAt <= now
  const selectedGoalscorer = overview.eligiblePlayers.find((player) => player.id === goalscorerPickId) ?? null
  const filteredGoalscorers = useMemo(
    () => filterGoalscorers(overview.eligiblePlayers, goalscorerSearch).slice(0, 80),
    [goalscorerSearch, overview.eligiblePlayers],
  )
  const tournamentGroups = useMemo(() => getTournamentGroups(overview), [overview])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNow(Date.now()), Math.max(overview.pool.entryLockAt - Date.now(), 0))
    return () => window.clearTimeout(timeoutId)
  }, [overview.pool.entryLockAt])

  function toggleTeam(teamId: string, requiredPicks: number, tierTeamIds: string[]) {
    setSelectedTeamIds((current) => {
      if (current.includes(teamId)) {
        return current.filter((id) => id !== teamId)
      }

      const pickedInTier = current.filter((id) => tierTeamIds.includes(id))

      if (pickedInTier.length < requiredPicks) {
        return [...current, teamId]
      }

      const [oldestPick] = pickedInTier
      return [...current.filter((id) => id !== oldestPick), teamId]
    })
  }

  async function handleSave() {
    setError(null)
    setIsSaving(true)

    try {
      await saveEntry(selectedTeamIds, goalscorerPickId || null)
      const nextOverview = await getOverview()

      if (nextOverview !== null) {
        onOverviewChange(nextOverview)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido guardar la entrada.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi entrada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {overview.teamTiers.length === 0 ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Todavía no hay bombos configurados.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setShowTournamentGroups((current) => !current)}>
                <ListChecks className="size-4" aria-hidden="true" />
                {showTournamentGroups ? 'Ocultar grupos' : 'Ver grupos'}
              </Button>
            </div>
            {showTournamentGroups ? <TournamentGroups groups={tournamentGroups} /> : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {overview.teamTiers.map((tier) => {
            const tierTeamIds = tier.teams.map((team) => team.id)
            const pickedInTier = selectedTeamIds.filter((id) => tierTeamIds.includes(id)).length

            return (
              <div key={tier.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium">{tier.name}</p>
                  <p className={pickedInTier === tier.requiredPicks ? 'text-muted-foreground' : 'text-destructive'}>
                    {pickedInTier}/{tier.requiredPicks}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tier.teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className={`flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${selectedTeamIds.includes(team.id) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                      disabled={isLocked}
                      onClick={() => toggleTeam(team.id, tier.requiredPicks, tierTeamIds)}
                    >
                      <span className="text-lg leading-none" aria-hidden="true">{getFlagEmoji(team.fifaCode)}</span>
                      <span className="min-w-0">
                        <span className="block font-medium">{team.name}</span>
                        <span className="text-xs opacity-75">Grupo {team.groupCode}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
              })}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <p className="text-sm font-medium">Goleador elegido</p>
          {overview.eligiblePlayers.length === 0 ? (
            <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Todavía no hay goleadores configurados.</p>
          ) : (
            <Combobox.Root
              value={goalscorerPickId || null}
              onValueChange={(value) => {
                setGoalscorerPickId(typeof value === 'string' ? value : '')
                setGoalscorerSearch('')
              }}
              inputValue={goalscorerSearch}
              onInputValueChange={setGoalscorerSearch}
              disabled={isLocked}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Combobox.Input
                  className="pl-9"
                  placeholder={selectedGoalscorer ? `${selectedGoalscorer.name} · ${selectedGoalscorer.teamName}` : 'Buscar goleador o selección'}
                />
              </div>
              <Combobox.Portal>
                <Combobox.Positioner sideOffset={6}>
                  <Combobox.Popup>
                    <Combobox.Empty>No hay goleadores que coincidan.</Combobox.Empty>
                    <Combobox.List>
                      {filteredGoalscorers.map((player) => (
                        <Combobox.Item key={player.id} value={player.id}>
                          <span className="text-lg leading-none" aria-hidden="true">{getFlagEmoji(player.teamFifaCode)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{player.name}</span>
                            <span className="block truncate text-xs opacity-75">{player.teamName} · {player.teamFifaCode} · Grupo {player.groupCode}</span>
                          </span>
                          {goalscorerPickId === player.id ? <Check className="size-4" aria-hidden="true" /> : null}
                        </Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
              {selectedGoalscorer ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-lg leading-none" aria-hidden="true">{getFlagEmoji(selectedGoalscorer.teamFifaCode)}</span>
                  Seleccionado: <span className="font-medium text-foreground">{selectedGoalscorer.name}</span>
                </p>
              ) : null}
            </Combobox.Root>
          )}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={isLocked || isSaving} onClick={handleSave}>
          <Save className="size-4" aria-hidden="true" />
          {isSaving ? 'Guardando...' : 'Guardar entrada'}
        </Button>
      </CardContent>
    </Card>
  )
}

function Setup({ overview }: { overview: Overview }) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" aria-hidden="true" />
            Grupos de equipos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {overview.teamTiers.map((tier) => (
            <div key={tier.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{tier.name}</p>
                <span className="text-muted-foreground">{tier.requiredPicks} elecciones</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tier.teams.map((team) => (
                  <span key={team.id} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {team.fifaCode} · {team.groupCode}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bonus por ronda</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          {overview.stageBonuses.map((bonus) => (
            <div key={bonus.id} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{bonus.stage}</p>
              <p className="text-muted-foreground">{bonus.points} puntos</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function TournamentGroups({ groups }: { groups: ReturnType<typeof getTournamentGroups> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <div key={group.groupCode} className="rounded-md border p-3 text-sm">
          <p className="font-medium">Grupo {group.groupCode}</p>
          <div className="mt-3 space-y-2">
            {group.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-lg leading-none" aria-hidden="true">{getFlagEmoji(team.fifaCode)}</span>
                  <span className="truncate font-medium">{team.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{team.tierName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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

function getPoolStatusLabel(status: Overview['pool']['status']) {
  const labels = {
    setup: 'Configuración',
    open: 'Abierta',
    locked: 'Cerrada',
    scoring: 'Puntuando',
  }

  return labels[status]
}

function getTournamentGroups(overview: Overview) {
  const groups = new Map<string, Array<Overview['teamTiers'][number]['teams'][number] & { tierName: string }>>()

  for (const tier of overview.teamTiers) {
    for (const team of tier.teams) {
      const groupCode = team.groupCode || '?'
      groups.set(groupCode, [...(groups.get(groupCode) ?? []), { ...team, tierName: tier.name }])
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupCode, teams]) => ({
      groupCode,
      teams: teams.sort((left, right) => left.name.localeCompare(right.name)),
    }))
}

function filterGoalscorers(players: Overview['eligiblePlayers'], search: string) {
  const tokens = normalizeSearch(search).split(' ').filter(Boolean)

  if (tokens.length === 0) {
    return players
  }

  return players.filter((player) => {
    const searchable = normalizeSearch(
      [player.name, player.teamName, player.teamFifaCode, getFifaCodeAliases(player.teamFifaCode)].join(' '),
    )
    return tokens.every((token) => searchable.includes(token))
  })
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getFifaCodeAliases(fifaCode: string) {
  const aliases: Record<string, string> = {
    ENG: 'ing inglaterra england',
    GER: 'ale alemania germany',
    KOR: 'cor corea korea',
    NED: 'hol paises bajos netherlands holland',
    NOR: 'nor noruega norway',
    RSA: 'sud sudafrica south africa',
    SUI: 'sui suiza switzerland',
    USA: 'eeuu estados unidos united states',
  }

  return aliases[fifaCode] ?? ''
}

function getFlagEmoji(fifaCode: string) {
  const isoByFifaCode: Record<string, string> = {
    ALG: 'DZ',
    ARG: 'AR',
    AUS: 'AU',
    AUT: 'AT',
    BEL: 'BE',
    BIH: 'BA',
    BRA: 'BR',
    CAN: 'CA',
    CIV: 'CI',
    COD: 'CD',
    COL: 'CO',
    CPV: 'CV',
    CRO: 'HR',
    CUW: 'CW',
    CZE: 'CZ',
    ECU: 'EC',
    EGY: 'EG',
    ENG: 'GB-ENG',
    ESP: 'ES',
    FRA: 'FR',
    GER: 'DE',
    GHA: 'GH',
    HAI: 'HT',
    IRN: 'IR',
    IRQ: 'IQ',
    JOR: 'JO',
    JPN: 'JP',
    KOR: 'KR',
    KSA: 'SA',
    MAR: 'MA',
    MEX: 'MX',
    NED: 'NL',
    NOR: 'NO',
    NZL: 'NZ',
    PAN: 'PA',
    PAR: 'PY',
    POR: 'PT',
    QAT: 'QA',
    RSA: 'ZA',
    SCO: 'GB-SCT',
    SEN: 'SN',
    SUI: 'CH',
    SWE: 'SE',
    TUN: 'TN',
    TUR: 'TR',
    URU: 'UY',
    USA: 'US',
    UZB: 'UZ',
  }
  const isoCode = isoByFifaCode[fifaCode] ?? fifaCode

  if (isoCode === 'GB-ENG') {
    return '🏴'
  }

  if (isoCode === 'GB-SCT') {
    return '🏴'
  }

  if (!/^[A-Z]{2}$/.test(isoCode)) {
    return '🏳'
  }

  return String.fromCodePoint(...[...isoCode].map((character) => 127397 + character.charCodeAt(0)))
}

export default App
