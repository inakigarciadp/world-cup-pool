import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { CalendarClock, ChevronDown, LogOut, Shield, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { logoutSession } from '@/lib/auth-session'
import type { Overview } from '@/lib/httpApi'
import { overviewQueryOptions, requireLoadedOverview } from '@/lib/overview-query'
import { OverviewContext } from '@/lib/overview-context'
import { getPoolStatusLabel } from '@/lib/pool'

export function AuthenticatedLayout({ initialOverview }: { initialOverview: Overview }) {
  const { data } = useQuery({
    ...overviewQueryOptions,
    initialData: initialOverview,
  })
  const overview = requireLoadedOverview(data)
  const navigate = useNavigate()
  const logoutMutation = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      await navigate({ to: '/login' })
    },
  })

  function handleLogout() {
    logoutMutation.mutate()
  }

  return (
    <OverviewContext.Provider value={{ overview }}>
      <main className="app-surface min-h-svh text-foreground">
        <header className="top-bar">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 text-[1.35rem] leading-tight font-black tracking-normal sm:text-3xl">
                Porra TARAVERO
              </h1>
              <PoolDetails
                participantName={overview.session.participantName}
                isAdmin={overview.session.isAdmin}
                entryLockAt={overview.pool.entryLockAt}
                poolStatus={overview.pool.status}
                isLoggingOut={logoutMutation.isPending}
                onLogout={handleLogout}
              />
            </div>
            <nav className="nav-strip flex items-center gap-1" aria-label="Navegación principal">
              <NavLink to="/" label="Clasificación" />
              <NavLink to="/entries" label="Apuestas" />
              <NavLink to="/rules" label="Reglas" />
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          <Outlet />
        </div>
      </main>
    </OverviewContext.Provider>
  )
}

function PoolDetails({
  participantName,
  isAdmin,
  entryLockAt,
  poolStatus,
  isLoggingOut,
  onLogout,
}: {
  participantName: string
  isAdmin: boolean
  entryLockAt: number
  poolStatus: Overview['pool']['status']
  isLoggingOut: boolean
  onLogout: () => void
}) {
  return (
    <details className="pool-details">
      <summary className="pool-details-trigger" aria-label="Ver detalles de la porra">
        <UserRound className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Detalles</span>
        <ChevronDown className="pool-details-chevron size-4" aria-hidden="true" />
      </summary>
      <div className="pool-details-panel">
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            <Shield className="size-4" aria-hidden="true" />
            Sesión
          </h2>
          <div className="space-y-1 text-sm">
            <p className="text-base font-black">{participantName}</p>
            <p className="text-muted-foreground">
              {isAdmin ? 'Participante administrador' : 'Participante'}
            </p>
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden="true" />
            Cierre de apuestas
          </h2>
          <div className="space-y-1 text-sm">
            <p className="font-bold">
              {new Intl.DateTimeFormat('es-ES', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(entryLockAt)}
            </p>
            <p className="text-muted-foreground">{getPoolStatusLabel(poolStatus)}</p>
          </div>
        </section>
        <Button
          className="w-full justify-center font-black"
          type="button"
          variant="outline"
          disabled={isLoggingOut}
          onClick={onLogout}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Salir
        </Button>
      </div>
    </details>
  )
}

function NavLink({ to, label }: { to: '/' | '/entries' | '/rules'; label: string }) {
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
