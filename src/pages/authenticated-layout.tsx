import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import {
  CalendarClock,
  ChevronDown,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'

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

  const initials = getInitials(overview.session.participantName)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <OverviewContext.Provider value={{ overview }}>
      <main className="app-shell min-h-svh text-foreground">
        <header className="topbar">
          <Link to="/" className="wordmark" aria-label="Inicio">
            <span className="display-num text-[1.45rem]">TARAVERO</span>
            <span className="ball-mini" aria-hidden="true" />
          </Link>
          <ProfilePill
            initials={initials}
            name={overview.session.participantName}
            isAdmin={overview.session.isAdmin}
            entryLockAt={overview.pool.entryLockAt}
            poolStatus={overview.pool.status}
            now={now}
            isLoggingOut={logoutMutation.isPending}
            onLogout={() => logoutMutation.mutate()}
          />
        </header>

        <div className="page-frame">
          <Outlet />
        </div>

        <BottomNav />
      </main>
    </OverviewContext.Provider>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function ProfilePill({
  initials,
  name,
  isAdmin,
  entryLockAt,
  poolStatus,
  now,
  isLoggingOut,
  onLogout,
}: {
  initials: string
  name: string
  isAdmin: boolean
  entryLockAt: number
  poolStatus: Overview['pool']['status']
  now: number
  isLoggingOut: boolean
  onLogout: () => void
}) {
  const ref = useRef<HTMLDetailsElement | null>(null)
  const countdown = getCountdownLabel(entryLockAt, now)
  const locked = entryLockAt <= now || poolStatus === 'locked'

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!ref.current?.open) return
      if (ref.current.contains(event.target as Node)) return
      ref.current.removeAttribute('open')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <details ref={ref} className="relative">
      <summary className="profile-pill list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="hidden sm:inline max-w-[8rem] truncate">{name}</span>
        <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
      </summary>
      <div className="sticker absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] p-4">
        <div className="flex items-center gap-3">
          <span className="avatar flex h-12 w-12 items-center justify-center rounded-full bg-coral text-lg font-extrabold text-paper">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="heading text-base leading-tight">{name}</p>
            <p className="text-xs font-semibold text-ink-soft">
              {isAdmin ? 'Participante y admin' : 'Participante'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-paper-deep/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Cierre
            </span>
            <span className={`countdown ${locked ? 'is-locked' : ''}`}>
              {locked ? 'Cerrado' : countdown}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Estado
            </span>
            <span className="pill pill-sun">{getPoolStatusLabel(poolStatus)}</span>
          </div>
          {isAdmin ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Permisos
              </span>
              <span className="pill pill-coral">Admin</span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-2.5 font-heading text-sm font-bold text-paper disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {isLoggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    </details>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <div className="bottom-nav-inner">
        <Tab to="/" label="Porra" icon={Trophy} exact />
        <Tab to="/rules" label="Reglas" icon={Sparkles} />
        <Tab to="/entries" label="Apuestas" icon={ClipboardList} />
      </div>
    </nav>
  )
}

function Tab({
  to,
  label,
  icon: Icon,
  exact = false,
}: {
  to: '/' | '/entries' | '/rules'
  label: string
  icon: typeof Trophy
  exact?: boolean
}) {
  return (
    <Link
      to={to}
      className="tab-btn"
      activeProps={{ className: 'tab-btn is-active' }}
      activeOptions={{ exact }}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  )
}

function getCountdownLabel(targetMs: number, nowMs: number) {
  const diff = targetMs - nowMs
  if (diff <= 0) return 'Cerrado'
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days > 0) return `${days} d para el cierre`
  const hours = Math.floor(diff / (60 * 60 * 1000))
  if (hours > 0) return `${hours} h para el cierre`
  const minutes = Math.floor(diff / (60 * 1000))
  return `${minutes} min para el cierre`
}
