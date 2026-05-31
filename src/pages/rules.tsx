import { CircleHelp, Flag, Goal, Medal, Trophy } from 'lucide-react'

const teamRules = [
  '1 selección del Bombo 1',
  '2 selecciones del Bombo 2',
  '2 selecciones del Bombo 3',
  '2 selecciones del Bombo 4',
]

const multipliers = [
  ['Bombo 1', 'x1'],
  ['Bombo 2', 'x1,25'],
  ['Bombo 3', 'x1,5'],
  ['Bombo 4', 'x1,75'],
]

const matchPoints = [
  ['Victoria en partido', '3 pts.'],
  ['Empate', '1 pt.'],
  ['Derrota', '0 pts.'],
  ['Victoria en tanda de penaltis', '1 pt. total'],
  ['Derrota en tanda de penaltis', '0 pts.'],
]

const stageBonuses = [
  ['Dieciseisavos', '+5 pts.'],
  ['Octavos', '+7,5 pts.'],
  ['Cuartos', '+10 pts.'],
  ['Semifinales', '+15 pts.'],
  ['Campeón del Mundial', '+20 pts.'],
]

const goalscorerPoints = [
  ['Gol oficial del jugador', '1 pt.'],
  ['Máximo goleador del torneo', '+10 pts.'],
]

export function RulesPage() {
  return (
    <section className="rules-page space-y-6">
      <div className="rules-hero">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Cómo se juega
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">
          Una porra para sufrir cada jornada
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Antes de que cierre la entrada, haces tus apuestas: siete selecciones y cuatro goleadores.
          A partir de ahí, cada partido suma, cada ronda pesa y los bombos modestos pueden cambiar
          la clasificación.
        </p>
      </div>

      <div className="rules-story-grid">
        <article className="rules-block">
          <div className="rules-icon">
            <Flag className="size-5" aria-hidden="true" />
          </div>
          <h3>Tu equipo para el Mundial</h3>
          <p>
            La entrada combina favoritos y apuestas con más riesgo. Los bombos vienen del sorteo:
            cuanto más bajo es el bombo, más multiplica lo que consigas con esa selección.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {teamRules.map((rule) => (
              <span key={rule} className="rules-chip">
                {rule}
              </span>
            ))}
          </div>
        </article>

        <article className="rules-block">
          <div className="rules-icon">
            <Goal className="size-5" aria-hidden="true" />
          </div>
          <h3>Cuatro goleadores, uno por bombo</h3>
          <p>
            También eliges un goleador de cada bombo. No tiene por qué jugar en una de tus
            selecciones: aquí vas a por olfato. Sus goles suman con el multiplicador de su bombo.
          </p>
          <p className="rules-note">
            Cuentan los goles oficiales en partido, incluidos penaltis durante el juego. No cuentan
            tandas de penaltis ni goles en propia puerta.
          </p>
        </article>
      </div>

      <div className="rules-score-strip">
        <article>
          <Medal className="size-5" aria-hidden="true" />
          <h3>Los partidos dan ritmo</h3>
          <p>Primero se mira el resultado de cada una de tus selecciones.</p>
          <RulesPointList items={matchPoints} />
        </article>
        <article>
          <Trophy className="size-5" aria-hidden="true" />
          <h3>Las rondas dan golpes grandes</h3>
          <p>Cuando una selección confirma una ronda, añade un bonus una sola vez.</p>
          <RulesPointList items={stageBonuses} />
        </article>
        <article>
          <CircleHelp className="size-5" aria-hidden="true" />
          <h3>El pichichi tiene premio</h3>
          <p>
            Los goleadores suman durante todo el torneo, aunque su selección no sea una de tus
            siete.
          </p>
          <RulesPointList items={goalscorerPoints} />
        </article>
      </div>

      <section className="rules-multipliers">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Multiplicadores
          </p>
          <h3>Elegir un bombo bajo puede salir caro... o genial</h3>
        </div>
        <div className="rules-multiplier-grid">
          {multipliers.map(([tier, multiplier]) => (
            <div key={tier} className="rules-multiplier">
              <span>{tier}</span>
              <strong>{multiplier}</strong>
            </div>
          ))}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          La clasificación suma todo: selecciones, goleadores y bonus. Por eso pueden aparecer
          decimales como 4,5 u 8,75 puntos.
        </p>
      </section>
    </section>
  )
}

function RulesPointList({ items }: { items: string[][] }) {
  return (
    <dl className="rules-point-list">
      {items.map(([label, value]) => (
        <div key={label} className="rules-point-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
