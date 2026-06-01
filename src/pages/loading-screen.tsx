export function LoadingScreen() {
  return (
    <main className="app-shell flex min-h-svh items-center justify-center px-5 text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="ball" aria-hidden="true" />
        <p className="eyebrow text-ink-soft">Cargando porra…</p>
      </div>
    </main>
  )
}
