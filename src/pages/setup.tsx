import { ListChecks } from 'lucide-react'

import { useOverview } from '@/lib/overview-context'

export function SetupPage() {
  const { overview } = useOverview()

  return (
    <section className="space-y-4">
      <section className="setup-section">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
          <ListChecks className="size-5" aria-hidden="true" />
          Grupos de equipos
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {overview.teamTiers.map((tier) => (
            <div key={tier.id} className="tier-block text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{tier.name}</p>
                <span className="text-muted-foreground">{tier.requiredPicks} elecciones</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tier.teams.map((team) => (
                  <span key={team.id} className="team-chip">
                    {team.fifaCode} · {team.groupCode}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="setup-section">
        <h2 className="mb-4 text-xl font-black">Bonus por ronda</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {overview.stageBonuses.map((bonus) => (
            <div key={bonus.id} className="bonus-pill text-sm">
              <p className="font-black">{bonus.stage}</p>
              <p className="text-muted-foreground">{bonus.points} puntos</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}
