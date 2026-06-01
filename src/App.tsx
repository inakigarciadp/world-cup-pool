import { Outlet } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

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

  return <Outlet />
}

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <section className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-11 rotate-[-4deg] items-center justify-center rounded-lg border-2 border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-black tracking-normal">Porra TARAVERO</h1>
      </div>
      <Card className="login-card">
        <CardContent className="space-y-4 pt-2">{children}</CardContent>
      </Card>
    </section>
  )
}
