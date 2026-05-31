import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { CalendarClock, LogOut, Shield, Trophy } from 'lucide-react'

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
              <NavLink to="/rules" label="Reglas" />
              <NavLink to="/setup" label="Configuración" />
              <Button
                className="ml-1"
                type="button"
                variant="ghost"
                disabled={logoutMutation.isPending}
                onClick={handleLogout}
              >
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

function NavLink({ to, label }: { to: '/' | '/entries' | '/rules' | '/setup'; label: string }) {
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
