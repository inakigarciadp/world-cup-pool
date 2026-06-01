import type { Overview } from '@/lib/httpApi'
import { useOverview } from '@/lib/overview-context'

export function LeaderboardPage() {
  const { overview } = useOverview()
  const myName = overview.session.participantName
  const top = overview.leaderboard.slice(0, 3)
  const rest = overview.leaderboard.slice(3)
  const myRank = overview.leaderboard.findIndex((entry) => entry.participantName === myName)
  const myEntry = myRank >= 0 ? overview.leaderboard[myRank] : null

  return (
    <section className="space-y-6">
      <HeroCard
        myName={myName}
        myRank={myRank + 1}
        myScore={myEntry?.currentScore ?? 0}
        submitted={myEntry?.submittedAt != null}
      />

      <div>
        <div className="section-label mb-3">Podio</div>
        <Podium top={top} myName={myName} />
      </div>

      {rest.length > 0 ? (
        <div className="space-y-3">
          <div className="section-label">El resto</div>
          <ul className="space-y-2.5">
            {rest.map((entry, index) => {
              const rank = index + 4
              const isMe = entry.participantName === myName
              return (
                <li key={entry.entryId} className={`leaderboard-row ${isMe ? 'is-me' : ''}`}>
                  <span className="rank-circle">{rank}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-sm font-bold">
                      {entry.participantName}
                      {isMe ? (
                        <span className="ml-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-80">
                          (tú)
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.12em] opacity-60">
                      {entry.submittedAt ? 'Entrada enviada' : 'Pendiente'}
                    </span>
                  </span>
                  <span className="leaderboard-score">
                    {formatScore(entry.currentScore)}
                    <small>pts</small>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {overview.leaderboard.length === 0 ? (
        <div className="sticker-soft px-5 py-8 text-center">
          <p className="heading text-lg">Aún no hay apuestas</p>
          <p className="mt-1 text-sm text-ink-soft">
            Sé el primero en elegir tus 7 selecciones y 4 goleadores.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function HeroCard({
  myName,
  myRank,
  myScore,
  submitted,
}: {
  myName: string
  myRank: number
  myScore: number
  submitted: boolean
}) {
  return (
    <article className="hero-card">
      <p className="hero-greeting">Tu porra</p>
      <h2 className="hero-name text-balance">{firstName(myName)}</h2>
      <p className="hero-sub">
        {submitted
          ? myRank > 0
            ? `Vas en posición ${myRank}.`
            : 'Aún no has enviado tu entrada.'
          : 'Aún no has enviado tu entrada.'}
      </p>
      <div className="hero-score">
        <span className="hero-score-num">{formatScore(myScore)}</span>
        <span className="hero-score-unit">puntos</span>
      </div>
      <div className="hero-sticker" aria-hidden="true">
        {myRank > 0 ? `#${myRank}` : '—'}
      </div>
    </article>
  )
}

function Podium({ top, myName }: { top: Overview['leaderboard']; myName: string }) {
  if (top.length === 0) return null
  const order = [1, 0, 2]
  const labels = ['2º', '1º', '3º']

  return (
    <div className="leaderboard-podium">
      {order.map((topIndex, slot) => {
        const entry = top[topIndex]
        if (!entry) {
          return <div key={`empty-${slot}`} className="opacity-0" />
        }
        const isMe = entry.participantName === myName
        return (
          <div key={entry.entryId} className="podium-step" data-place={topIndex + 1}>
            <span className="podium-place" aria-label={labels[slot]}>
              {topIndex + 1}
            </span>
            <div className="podium-avatar">{getInitials(entry.participantName)}</div>
            <div className="min-w-0 text-center">
              <p className="truncate font-heading text-sm font-extrabold">
                {entry.participantName}
                {isMe ? (
                  <span className="ml-1 text-[0.6rem] uppercase tracking-[0.12em] opacity-80">
                    (tú)
                  </span>
                ) : null}
              </p>
            </div>
            <p className="podium-score">
              {formatScore(entry.currentScore)}
              <span className="ml-1 text-[0.55rem] font-bold opacity-80">pts</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function formatScore(value: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value)
}
