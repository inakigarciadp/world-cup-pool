import { Crown, Flag, Goal, Medal, Trophy } from 'lucide-react'

import { useOverview } from '@/lib/overview-context'

const matchPoints = [
  ['Victoria en partido', '3 pts'],
  ['Empate', '1 pt'],
  ['Derrota', '0 pts'],
  ['Victoria en penaltis', '1 pt total'],
  ['Derrota en penaltis', '0 pts'],
]

const stageBonuses = [
  ['Dieciseisavos', '+5'],
  ['Octavos', '+7,5'],
  ['Cuartos', '+10'],
  ['Semifinales', '+15'],
  ['Campeón', '+20'],
]

const goalscorerPoints = [
  ['Gol oficial', '1 pt'],
  ['Pichichi del torneo', '+10'],
]

export function RulesPage() {
  const { overview } = useOverview()
  const teamRules = overview.teamTiers.map((tier) => [
    tier.name,
    `${tier.requiredPicks} ${tier.requiredPicks === 1 ? 'selección' : 'selecciones'}`,
  ])
  const multipliers = overview.teamTiers.map((tier) => [
    tier.name,
    formatMultiplier(tier.multiplier),
  ])

  return (
    <section className="space-y-6">
      <header className="rules-hero">
        <p className="eyebrow opacity-80">Cómo se juega</p>
        <h1>Una porra para sufrir cada jornada.</h1>
        <p>
          Antes de que cierre la entrada, eliges 7 selecciones y 4 goleadores. A partir de ahí, cada
          partido suma, cada ronda pesa y los bombos modestos pueden cambiar la clasificación.
        </p>
      </header>

      <article className="rule-block">
        <div className="rule-icon">
          <Flag className="size-5" aria-hidden="true" />
        </div>
        <h3>Tu equipo para el Mundial</h3>
        <p>
          La entrada combina favoritos y apuestas con más riesgo. Cuanto más bajo es el bombo, más
          multiplica lo que consigas con esa selección.
        </p>
        <div className="rule-list">
          {teamRules.map(([tier, picks]) => (
            <div key={tier} className="rule-list-row">
              <span>{tier}</span>
              <span className="v">{picks}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="rule-block">
        <div className="rule-icon" style={{ background: 'var(--mint)', color: 'var(--mint-ink)' }}>
          <Goal className="size-5" aria-hidden="true" />
        </div>
        <h3>Cuatro goleadores, uno por bombo</h3>
        <p>
          También eliges un goleador de cada bombo. No tiene que jugar en una de tus selecciones:
          vas a por olfato. Sus goles suman con el multiplicador de su bombo.
        </p>
        <p className="mt-3 text-xs font-semibold italic text-ink-soft">
          Cuentan goles oficiales en partido (incluido penaltis durante el juego). No cuentan tandas
          ni goles en propia puerta.
        </p>
      </article>

      <div className="grid gap-4">
        <article className="rule-block">
          <div className="rule-icon" style={{ background: 'var(--sun)', color: 'var(--sun-ink)' }}>
            <Medal className="size-5" aria-hidden="true" />
          </div>
          <h3>Los partidos dan ritmo</h3>
          <p>Primero se mira el resultado de cada una de tus selecciones.</p>
          <div className="rule-list">
            {matchPoints.map(([label, value]) => (
              <div key={label} className="rule-list-row">
                <span>{label}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rule-block">
          <div className="rule-icon" style={{ background: 'var(--coral)', color: 'var(--paper)' }}>
            <Trophy className="size-5" aria-hidden="true" />
          </div>
          <h3>Las rondas dan golpes grandes</h3>
          <p>Cuando una selección confirma una ronda, añade un bonus una sola vez.</p>
          <div className="rule-list">
            {stageBonuses.map(([label, value]) => (
              <div key={label} className="rule-list-row">
                <span>{label}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rule-block">
          <div className="rule-icon" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <Crown className="size-5" aria-hidden="true" />
          </div>
          <h3>El pichichi tiene premio</h3>
          <p>
            Los goleadores suman durante todo el torneo, aunque su selección no sea una de tus
            siete. Cada gol se multiplica por el bombo del jugador.
          </p>
          <div className="rule-list">
            {goalscorerPoints.map(([label, value]) => (
              <div key={label} className="rule-list-row">
                <span>{label}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold italic text-ink-soft">
            El bonus del pichichi del torneo es plano: no recibe el multiplicador del bombo.
          </p>
        </article>
      </div>

      <section className="sticker p-5">
        <p className="eyebrow text-coral-ink">Multiplicadores</p>
        <h3 className="heading mt-1 text-xl">Elegir un bombo bajo puede salir caro… o genial.</h3>
        <div className="rule-list mt-4">
          {multipliers.map(([tier, multiplier]) => (
            <div key={tier} className="rule-list-row">
              <span>{tier}</span>
              <span className="v">{multiplier}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          La clasificación suma todo: selecciones, goleadores y bonus. Por eso pueden aparecer
          decimales como 4,5 u 8,75 puntos.
        </p>
      </section>
    </section>
  )
}

function formatMultiplier(value: number | null) {
  if (value === null) return '-'

  return `x${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value)}`
}
