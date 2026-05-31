import { CircleDot, Trophy } from 'lucide-react'

import { useOverview } from '@/lib/overview-context'

export function LeaderboardPage() {
  const { overview } = useOverview()

  return (
    <section className="space-y-4">
      <div className="metric-strip">
        <Metric label="Participantes" value={overview.counts.participants} />
        <Metric label="Apuestas" value={overview.counts.entries} />
        <Metric label="Equipos" value={overview.counts.teams} />
        <Metric label="Goleadores" value={overview.counts.eligiblePlayers} />
      </div>
      <section className="leaderboard-panel">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="size-5" aria-hidden="true" />
          <h2 className="text-xl font-black">Clasificación</h2>
        </div>
        <div className="leaderboard-list">
          {overview.leaderboard.map((entry, index) => (
            <div key={entry.entryId} className="leaderboard-row">
              <span className="rank-badge">{index + 1}</span>
              <span className="font-bold">{entry.participantName}</span>
              <span className="justify-self-end font-black">{entry.currentScore} pts.</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-item">
      <CircleDot className="size-3 text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  )
}
