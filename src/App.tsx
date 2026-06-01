import { Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function App() {
  if (!import.meta.env.VITE_CONVEX_URL || !import.meta.env.VITE_CONVEX_SITE_URL) {
    return (
      <main className="app-shell flex min-h-svh items-center justify-center px-5 text-foreground">
        <div className="page-frame flex flex-col items-center gap-5">
          <SoccerBall />
          <p className="login-banner text-center">
            Configura <code className="font-bold">VITE_CONVEX_URL</code> y{' '}
            <code className="font-bold">VITE_CONVEX_SITE_URL</code> para activar el acceso de
            participantes.
          </p>
          <code className="rounded-full border bg-surface px-3 py-1.5 text-xs font-bold tracking-wide">
            pnpm dev:convex
          </code>
        </div>
      </main>
    )
  }

  return <Outlet />
}

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell flex min-h-svh items-center justify-center px-5 py-10 text-foreground">
      <div className="page-frame flex w-full flex-col items-center gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <SoccerBall />
          <div className="space-y-1">
            <p className="eyebrow text-coral">Mundial 2026</p>
            <h1 className="display-title text-[2.6rem] leading-none">Porra TARAVERO</h1>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              La porra de la cuadrilla. Apuesta, sufre, repite.
            </p>
          </div>
        </header>
        <div className="login-card">{children}</div>
      </div>
    </main>
  )
}

function SoccerBall() {
  return <div className="ball" role="img" aria-label="Balón de fútbol" />
}
