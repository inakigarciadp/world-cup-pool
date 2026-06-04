import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type InputHTMLAttributes,
  type SetStateAction,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  Goal,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trophy,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  replaceMatchGoals,
  saveMatchResult,
  updateMatchTeams,
  type Match,
  type MatchesPayload,
} from '@/lib/httpApi'
import { matchesQueryOptions, requireLoadedMatches } from '@/lib/matches-query'
import { getFlagEmoji } from '@/lib/teams'
import { getUserErrorMessage } from '@/lib/user-error'

type GoalDraft = {
  id: string
  scoringTeamId: string
  creditedPlayerId: string
  isOwnGoal: boolean
  minuteLabel: string
}

export function MatchesPage() {
  const [includePast, setIncludePast] = useState(false)
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const { data, isLoading, error } = useQuery(matchesQueryOptions(includePast))
  const payload = data === null || data === undefined ? null : requireLoadedMatches(data)
  const visibleMatches =
    payload === null
      ? []
      : showOnlyMine
        ? payload.matches.filter((match) => match.hasCurrentParticipantStake)
        : payload.matches

  return (
    <section className="space-y-5">
      <header className="matches-hero">
        <div>
          <h1>Partidos</h1>
          <p>Calendario, resultados, goleadores y apuestas implicadas.</p>
        </div>
        <CalendarDays className="size-10 text-sun-ink" aria-hidden="true" />
      </header>

      <Tabs defaultValue="partidos">
        <TabsList aria-label="Contenido de partidos">
          <TabsTrigger value="partidos">Partidos</TabsTrigger>
          <TabsTrigger value="goleadores">Goleadores</TabsTrigger>
        </TabsList>

        <TabsContent value="partidos" className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="section-label">Calendario</div>
            <div className="matches-filter-row">
              {payload ? (
                <label className="match-filter-pill">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--coral)]"
                    checked={showOnlyMine}
                    onChange={(event) => setShowOnlyMine(event.target.checked)}
                  />
                  Mis partidos
                </label>
              ) : null}
              {payload?.tournamentStarted ? (
                <label className="match-filter-pill">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--coral)]"
                    checked={includePast}
                    onChange={(event) => setIncludePast(event.target.checked)}
                  />
                  Mostrar partidos anteriores
                </label>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="sticker-soft px-5 py-6 text-sm font-semibold text-ink-soft">
              Cargando partidos…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {getUserErrorMessage(error, 'No se han podido cargar los partidos.')}
            </div>
          ) : null}

          {payload && visibleMatches.length === 0 ? (
            <div className="sticker-soft px-5 py-8 text-center">
              <p className="heading text-lg">
                {showOnlyMine
                  ? 'No hay partidos tuyos en esta ventana'
                  : 'No hay partidos en esta ventana'}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {showOnlyMine
                  ? 'Desactiva Mis partidos o muestra partidos anteriores cuando el Mundial haya empezado.'
                  : 'Activa los partidos anteriores o importa el calendario oficial.'}
              </p>
            </div>
          ) : null}

          {payload ? (
            <div className="space-y-4">
              {visibleMatches.map((match) => (
                <MatchCard key={match.id} match={match} payload={payload} />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="goleadores">
          {isLoading ? (
            <div className="sticker-soft px-5 py-6 text-sm font-semibold text-ink-soft">
              Cargando goleadores…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {getUserErrorMessage(error, 'No se han podido cargar los goleadores.')}
            </div>
          ) : null}

          {payload ? <GoalscorerLeaderboard payload={payload} /> : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}

function GoalscorerLeaderboard({ payload }: { payload: MatchesPayload }) {
  const leaders = payload.goalscorerLeaderboard

  if (leaders.length === 0) {
    return (
      <div className="sticker-soft px-5 py-8 text-center">
        <p className="heading text-lg">Todavía no hay goleadores</p>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Aquí aparecerán los jugadores elegibles en cuanto marquen al menos un gol.
        </p>
      </div>
    )
  }

  return (
    <section className="goalscorer-board">
      <header className="goalscorer-board-head">
        <div>
          <p className="section-label">Goleadores</p>
          <h2>Tabla de goleadores</h2>
          <p>Solo jugadores elegibles con al menos un gol registrado.</p>
        </div>
        <Trophy className="size-9 text-coral-ink" aria-hidden="true" />
      </header>

      <div className="goalscorer-list">
        {leaders.map((leader, index) => (
          <article
            key={leader.playerId}
            className={`goalscorer-row ${index === 0 ? 'is-leading' : ''}`}
          >
            <div className="goalscorer-rank">{getGoalscorerRank(leaders, index)}</div>
            <div className="min-w-0 flex-1">
              <h3>{leader.playerName}</h3>
              <p>
                <span aria-hidden="true">{getFlagEmoji(leader.teamFifaCode)}</span>
                {leader.teamName}
              </p>
            </div>
            <div className="goalscorer-total">
              <span>{leader.goals}</span>
              <small>{leader.goals === 1 ? 'gol' : 'goles'}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MatchCard({ match, payload }: { match: Match; payload: MatchesPayload }) {
  return (
    <article className={`match-card ${match.hasCurrentParticipantStake ? 'is-mine' : ''}`}>
      <header className="match-card-head">
        <div className="min-w-0">
          <p className="match-kicker">
            Partido {match.matchNumber} · {formatStage(match.stage)}
          </p>
          <h2 className="match-date">{formatMatchDate(match.kickoffAt)}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {match.hasCurrentParticipantStake ? <span className="mine-chip">Mi partido</span> : null}
          {match.groupName ? (
            <span className="pill pill-sun">{formatGroup(match.groupName)}</span>
          ) : null}
        </div>
      </header>

      <div className="match-scoreboard">
        <TeamSide side={match.home} align="left" />
        <ResultBlock match={match} />
        <TeamSide side={match.away} align="right" />
      </div>

      <p className="match-venue">
        <MapPin className="size-4" aria-hidden="true" />
        {match.venueName} · {match.venueCity}
      </p>

      {match.goals.length > 0 ? (
        <section className="match-section">
          <p className="match-section-title">
            <Goal className="size-4" aria-hidden="true" />
            Goleadores
          </p>
          <div className="flex flex-wrap gap-1.5">
            {match.goals.map((goal) => (
              <span key={goal.id} className="goal-chip">
                {goal.minuteLabel ? `${goal.minuteLabel}’ ` : null}
                {goal.creditedPlayerName}
                {goal.isOwnGoal ? <span className="font-black text-coral-ink"> p.p.</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="match-section">
        <p className="match-section-title">Apuestas implicadas</p>
        {match.stakes.length > 0 ? (
          <div className="space-y-2">
            {match.stakes.map((group) => (
              <div key={group.participantId} className="stake-row">
                <span className="stake-name">{group.participantName}</span>
                <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
                  {group.stakes.map((stake, index) => (
                    <span
                      key={`${group.participantId}-${stake.kind}-${index}`}
                      className="stake-chip"
                    >
                      <span className="opacity-65">
                        {stake.kind === 'teamPick' ? 'Equipo' : 'Goleador'}
                      </span>
                      {stake.kind === 'teamPick' ? stake.teamName : stake.playerName}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-ink-soft">
            Sin apuestas en este partido todavía.
          </p>
        )}
      </section>

      {payload.session.isAdmin ? <AdminMatchEditor match={match} payload={payload} /> : null}
    </article>
  )
}

function TeamSide({ side, align }: { side: Match['home']; align: 'left' | 'right' }) {
  return (
    <div className={`match-side ${align === 'right' ? 'text-right' : ''}`}>
      <span className="team-flag" aria-hidden="true">
        {side.team ? getFlagEmoji(side.team.fifaCode) : '—'}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-heading text-sm font-extrabold leading-tight">
          {side.team?.name ?? side.placeholder}
        </span>
        <span className="block truncate text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
          {side.team ? side.placeholder : 'Por resolver'}
        </span>
      </span>
    </div>
  )
}

function ResultBlock({ match }: { match: Match }) {
  if (match.result === null) {
    return <div className="match-result-empty">vs</div>
  }

  const penaltyWinner =
    match.result.penaltyShootoutWinnerTeamId === match.home.team?.id
      ? match.home.team.name
      : match.result.penaltyShootoutWinnerTeamId === match.away.team?.id
        ? match.away.team.name
        : null

  return (
    <div className="match-result">
      <span>
        {match.result.homeGoals}–{match.result.awayGoals}
      </span>
      {penaltyWinner ? <small>Penaltis: {penaltyWinner}</small> : null}
    </div>
  )
}

function AdminMatchEditor({ match, payload }: { match: Match; payload: MatchesPayload }) {
  const queryClient = useQueryClient()
  const resolvedTeamIds = useMemo(
    () => [match.home.team?.id ?? null, match.away.team?.id ?? null].filter(isString),
    [match.away.team?.id, match.home.team?.id],
  )
  const playerOptions = payload.eligiblePlayers.filter(
    (player) => player.teamId !== null && resolvedTeamIds.includes(player.teamId),
  )
  const [homeTeamId, setHomeTeamId] = useState(match.home.team?.id ?? '')
  const [awayTeamId, setAwayTeamId] = useState(match.away.team?.id ?? '')
  const [homeGoals, setHomeGoals] = useState(match.result?.homeGoals.toString() ?? '')
  const [awayGoals, setAwayGoals] = useState(match.result?.awayGoals.toString() ?? '')
  const [penaltyWinnerTeamId, setPenaltyWinnerTeamId] = useState(
    match.result?.penaltyShootoutWinnerTeamId ?? '',
  )
  const [goalDrafts, setGoalDrafts] = useState<GoalDraft[]>(() => toGoalDrafts(match))

  useEffect(() => {
    setHomeTeamId(match.home.team?.id ?? '')
    setAwayTeamId(match.away.team?.id ?? '')
    setHomeGoals(match.result?.homeGoals.toString() ?? '')
    setAwayGoals(match.result?.awayGoals.toString() ?? '')
    setPenaltyWinnerTeamId(match.result?.penaltyShootoutWinnerTeamId ?? '')
    setGoalDrafts(toGoalDrafts(match))
  }, [match])

  const onMutationSuccess = async (successMessage: string) => {
    await queryClient.invalidateQueries({ queryKey: ['matches'] })
    toast.success(successMessage, {
      description: 'Los cambios se han guardado correctamente.',
    })
  }
  const onMutationError = (error: Error) => {
    toast.error('No se han podido guardar los cambios', {
      description: getUserErrorMessage(error),
    })
  }
  const teamsMutation = useMutation({
    mutationFn: () =>
      updateMatchTeams({
        matchId: match.id,
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
      }),
    onSuccess: () => onMutationSuccess('Selecciones guardadas'),
    onError: onMutationError,
  })
  const resultMutation = useMutation({
    mutationFn: () =>
      saveMatchResult({
        matchId: match.id,
        homeGoals: homeGoals === '' ? null : Number(homeGoals),
        awayGoals: awayGoals === '' ? null : Number(awayGoals),
        penaltyShootoutWinnerTeamId: penaltyWinnerTeamId || null,
      }),
    onSuccess: () => onMutationSuccess('Resultado guardado'),
    onError: onMutationError,
  })
  const goalsMutation = useMutation({
    mutationFn: () =>
      replaceMatchGoals({
        matchId: match.id,
        goals: goalDrafts
          .filter((goal) => goal.scoringTeamId && goal.creditedPlayerId)
          .map((goal) => ({
            scoringTeamId: goal.scoringTeamId,
            creditedPlayerId: goal.creditedPlayerId,
            isOwnGoal: goal.isOwnGoal,
            minuteLabel: goal.minuteLabel.trim() || null,
          })),
      }),
    onSuccess: () => onMutationSuccess('Goleadores guardados'),
    onError: onMutationError,
  })
  const clearResultMutation = useMutation({
    mutationFn: () =>
      saveMatchResult({
        matchId: match.id,
        homeGoals: null,
        awayGoals: null,
        penaltyShootoutWinnerTeamId: null,
      }),
    onSuccess: () => onMutationSuccess('Resultado borrado'),
    onError: onMutationError,
  })
  const canAddGoal = resolvedTeamIds.length > 0 && playerOptions.length > 0

  function addGoal() {
    const scoringTeamId = resolvedTeamIds[0] ?? ''
    const player =
      playerOptions.find((option) => option.teamId === scoringTeamId) ?? playerOptions[0] ?? null

    setGoalDrafts((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        scoringTeamId,
        creditedPlayerId: player?.id ?? '',
        isOwnGoal: false,
        minuteLabel: '',
      },
    ])
  }

  return (
    <details className="match-admin">
      <summary>
        <span>
          <ShieldCheck className="size-4" aria-hidden="true" />
          Editar partido
        </span>
        <Pencil className="size-4" aria-hidden="true" />
      </summary>

      <div className="match-admin-body">
        {match.completeness ? (
          <div className="admin-warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {match.completeness.missingGoals > 0
              ? `Faltan goleadores: ${match.completeness.recordedGoals}/${match.completeness.expectedGoals} registrados`
              : `Sobran goleadores: ${match.completeness.recordedGoals}/${match.completeness.expectedGoals} registrados`}
          </div>
        ) : null}

        <section className="admin-block">
          <p className="match-section-title">Selecciones</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <AdminSelect
              label={`Local · ${match.home.placeholder}`}
              value={homeTeamId}
              onChange={setHomeTeamId}
              options={payload.teams.map((team) => ({ value: team.id, label: team.name }))}
              emptyLabel="Sin resolver"
            />
            <AdminSelect
              label={`Visitante · ${match.away.placeholder}`}
              value={awayTeamId}
              onChange={setAwayTeamId}
              options={payload.teams.map((team) => ({ value: team.id, label: team.name }))}
              emptyLabel="Sin resolver"
            />
          </div>
          <button
            type="button"
            className="admin-action"
            disabled={teamsMutation.isPending}
            onClick={() => teamsMutation.mutate()}
          >
            <Save className="size-4" aria-hidden="true" />
            {teamsMutation.isPending ? 'Guardando…' : 'Guardar selecciones'}
          </button>
        </section>

        <section className="admin-block">
          <p className="match-section-title">Resultado</p>
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <AdminInput
              label={match.home.team?.name ?? 'Local'}
              value={homeGoals}
              onChange={setHomeGoals}
              type="number"
              min="0"
              inputMode="numeric"
            />
            <AdminInput
              label={match.away.team?.name ?? 'Visitante'}
              value={awayGoals}
              onChange={setAwayGoals}
              type="number"
              min="0"
              inputMode="numeric"
            />
          </div>
          <AdminSelect
            label="Ganador por penaltis"
            value={penaltyWinnerTeamId}
            onChange={setPenaltyWinnerTeamId}
            options={resolvedTeamIds.map((teamId) => ({
              value: teamId,
              label: payload.teams.find((team) => team.id === teamId)?.name ?? 'Selección',
            }))}
            emptyLabel="Sin tanda"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="admin-action"
              disabled={resultMutation.isPending}
              onClick={() => resultMutation.mutate()}
            >
              <Save className="size-4" aria-hidden="true" />
              {resultMutation.isPending ? 'Guardando…' : 'Guardar resultado'}
            </button>
            <button
              type="button"
              className="admin-action is-muted"
              disabled={clearResultMutation.isPending}
              onClick={() => clearResultMutation.mutate()}
            >
              Borrar resultado
            </button>
          </div>
        </section>

        <section className="admin-block">
          <div className="flex items-center justify-between gap-2">
            <p className="match-section-title">Goleadores</p>
            <button
              type="button"
              className="admin-icon-btn"
              disabled={!canAddGoal}
              onClick={addGoal}
            >
              <Plus className="size-4" aria-hidden="true" />
              Añadir
            </button>
          </div>

          {goalDrafts.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">Todavía no hay goleadores.</p>
          ) : (
            <div className="space-y-2">
              {goalDrafts.map((goal, index) => (
                <div key={goal.id} className="goal-edit-row">
                  <AdminInput
                    label="Min."
                    value={goal.minuteLabel}
                    onChange={(value) =>
                      updateGoalDraft(setGoalDrafts, index, { minuteLabel: value })
                    }
                    placeholder="45+2"
                  />
                  <AdminSelect
                    label="Marca"
                    value={goal.scoringTeamId}
                    onChange={(value) =>
                      updateGoalDraft(setGoalDrafts, index, { scoringTeamId: value })
                    }
                    options={resolvedTeamIds.map((teamId) => ({
                      value: teamId,
                      label: payload.teams.find((team) => team.id === teamId)?.name ?? 'Selección',
                    }))}
                    emptyLabel="Selección"
                  />
                  <AdminSelect
                    label="Jugador"
                    value={goal.creditedPlayerId}
                    onChange={(value) =>
                      updateGoalDraft(setGoalDrafts, index, { creditedPlayerId: value })
                    }
                    options={playerOptions.map((player) => ({
                      value: player.id,
                      label: `${player.name} · ${player.teamName}`,
                    }))}
                    emptyLabel="Goleador"
                  />
                  <label className="own-goal-toggle">
                    <input
                      type="checkbox"
                      checked={goal.isOwnGoal}
                      onChange={(event) =>
                        updateGoalDraft(setGoalDrafts, index, { isOwnGoal: event.target.checked })
                      }
                    />
                    p.p.
                  </label>
                  <button
                    type="button"
                    className="admin-icon-btn is-danger"
                    aria-label="Quitar goleador"
                    onClick={() =>
                      setGoalDrafts((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="admin-action"
            disabled={goalsMutation.isPending}
            onClick={() => goalsMutation.mutate()}
          >
            <Save className="size-4" aria-hidden="true" />
            {goalsMutation.isPending ? 'Guardando…' : 'Guardar goleadores'}
          </button>
        </section>
      </div>
    </details>
  )
}

function AdminSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  emptyLabel: string
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function AdminInput({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  )
}

function toGoalDrafts(match: Match): GoalDraft[] {
  return match.goals.map((goal) => ({
    id: goal.id,
    scoringTeamId: goal.scoringTeamId,
    creditedPlayerId: goal.creditedPlayerId,
    isOwnGoal: goal.isOwnGoal,
    minuteLabel: goal.minuteLabel ?? '',
  }))
}

function updateGoalDraft(
  setGoalDrafts: Dispatch<SetStateAction<GoalDraft[]>>,
  index: number,
  patch: Partial<GoalDraft>,
) {
  setGoalDrafts((current) =>
    current.map((goal, rowIndex) => (rowIndex === index ? { ...goal, ...patch } : goal)),
  )
}

function getGoalscorerRank(leaders: MatchesPayload['goalscorerLeaderboard'], index: number) {
  const leader = leaders[index]

  if (leader === undefined) {
    return index + 1
  }

  const previousLeaderIndex = leaders.findIndex((candidate) => candidate.goals === leader.goals)

  return previousLeaderIndex + 1
}

function formatMatchDate(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatStage(stage: string) {
  const labels: Record<string, string> = {
    'First Stage': 'Fase de grupos',
    'Round of 32': 'Dieciseisavos',
    'Round of 16': 'Octavos',
    'Quarter-final': 'Cuartos',
    'Semi-final': 'Semifinal',
    'Play-off for third place': 'Tercer puesto',
    Final: 'Final',
  }

  return labels[stage] ?? stage
}

function formatGroup(groupName: string) {
  return groupName.replace(/^Group /, 'Grupo ')
}

function isString(value: string | null): value is string {
  return value !== null
}
