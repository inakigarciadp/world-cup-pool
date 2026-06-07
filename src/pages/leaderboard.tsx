import { Link } from '@tanstack/react-router'

import type { Overview } from '@/lib/httpApi'
import { useOverview } from '@/lib/overview-context'

export function LeaderboardPage() {
  const { overview } = useOverview()
  const myParticipantId = overview.session.participantId
  const myName = overview.session.participantName
  const leaderboard = rankLeaderboard(overview.leaderboard)
  const top = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const myEntry = leaderboard.find((entry) => entry.participantId === myParticipantId) ?? null

  return (
    <section className="space-y-6">
      <HeroNav />

      <HeroCard
        myName={myName}
        myRank={myEntry?.rank ?? 0}
        myScore={myEntry?.currentScore ?? 0}
        hasEntry={myEntry?.entryId != null}
        submitted={myEntry?.submittedAt != null}
      />

      <div>
        <div className="section-label mb-3">Podio</div>
        <Podium top={top} myParticipantId={myParticipantId} />
      </div>

      {rest.length > 0 ? (
        <div className="space-y-3">
          <div className="section-label">El resto</div>
          <ul className="space-y-2.5">
            {rest.map((entry) => {
              const isMe = entry.participantId === myParticipantId
              const content = (
                <>
                  <span className="rank-circle">{formatRank(entry.rank)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-sm font-bold">
                      {entry.participantName}
                      {isMe ? (
                        <span className="ml-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-80">
                          (tú)
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="leaderboard-score">
                    {formatLeaderboardScore(entry)}
                    {entry.entryId != null ? <small>pts</small> : null}
                  </span>
                </>
              )

              if (isMe) {
                return (
                  <li key={entry.entryId ?? entry.participantId} className="leaderboard-row is-me">
                    {content}
                  </li>
                )
              }

              return (
                <li key={entry.entryId ?? entry.participantId}>
                  <Link
                    to="/entries"
                    search={{ participantId: entry.participantId }}
                    aria-label={`Ver apuesta de ${entry.participantName}`}
                    className="leaderboard-row"
                  >
                    {content}
                  </Link>
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
            Sé el primero en elegir tus{' '}
            {overview.teamTiers.reduce((total, tier) => total + tier.requiredPicks, 0)} selecciones
            y {overview.teamTiers.length} goleadores.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function HeroNav() {
  return (
    <nav className="hero-nav" aria-label="Atajos principales">
      <Link to="/rules" className="hero-nav-btn">
        Las reglas
      </Link>
      <Link to="/entries" className="hero-nav-btn">
        Haz tu porra
      </Link>
      <Link to="/matches" className="hero-nav-btn">
        Los partidos
      </Link>
    </nav>
  )
}

function HeroCard({
  myName,
  myRank,
  myScore,
  hasEntry,
  submitted,
}: {
  myName: string
  myRank: number
  myScore: number
  hasEntry: boolean
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
        <span className="hero-score-num">{hasEntry ? formatScore(myScore) : '-'}</span>
        {hasEntry ? <span className="hero-score-unit">puntos</span> : null}
      </div>
      <div className="hero-sticker" aria-hidden="true">
        {myRank > 0 ? `#${myRank}` : '—'}
      </div>
    </article>
  )
}

function Podium({
  top,
  myParticipantId,
}: {
  top: RankedLeaderboardEntry[]
  myParticipantId: string
}) {
  if (top.length === 0) return null
  const order = [1, 0, 2]
  return (
    <div className="leaderboard-podium">
      {order.map((topIndex, slot) => {
        const entry = top[topIndex]
        if (!entry) {
          return <div key={`empty-${slot}`} className="opacity-0" />
        }
        const isMe = entry.participantId === myParticipantId
        const content = (
          <>
            <span className="podium-place" aria-label={formatRankLabel(entry.rank)}>
              {formatRank(entry.rank)}
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
              {formatLeaderboardScore(entry)}
              {entry.entryId != null ? (
                <span className="ml-1 text-[0.55rem] font-bold opacity-80">pts</span>
              ) : null}
            </p>
          </>
        )

        if (isMe) {
          return (
            <div
              key={entry.entryId ?? entry.participantId}
              className="podium-step"
              data-place={entry.rank || topIndex + 1}
            >
              {content}
            </div>
          )
        }

        return (
          <Link
            key={entry.entryId ?? entry.participantId}
            to="/entries"
            search={{ participantId: entry.participantId }}
            aria-label={`Ver apuesta de ${entry.participantName}`}
            className="podium-step"
            data-place={entry.rank || topIndex + 1}
          >
            {content}
          </Link>
        )
      })}
    </div>
  )
}

type RankedLeaderboardEntry = Overview['leaderboard'][number] & { rank: number }

function rankLeaderboard(entries: Overview['leaderboard']): RankedLeaderboardEntry[] {
  let previousScore: number | null = null
  let previousRank = 0
  let scoredEntries = 0

  return entries.map((entry) => {
    if (entry.entryId === null) {
      return { ...entry, rank: 0 }
    }

    scoredEntries += 1

    if (previousScore === null || entry.currentScore !== previousScore) {
      previousRank = scoredEntries
      previousScore = entry.currentScore
    }

    return { ...entry, rank: previousRank }
  })
}

function formatRank(rank: number) {
  return rank > 0 ? rank : '—'
}

function formatRankLabel(rank: number) {
  return rank > 0 ? `${rank}º` : 'Sin posición'
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
    maximumFractionDigits: 3,
  }).format(value)
}

function formatLeaderboardScore(entry: Overview['leaderboard'][number]) {
  return entry.entryId === null ? '-' : formatScore(entry.currentScore)
}
