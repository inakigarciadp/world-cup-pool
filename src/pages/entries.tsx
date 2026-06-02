import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, ListChecks, Save, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Combobox } from '@/components/ui/combobox'
import { saveEntry, type Overview } from '@/lib/httpApi'
import { overviewQueryKey, overviewQueryOptions } from '@/lib/overview-query'
import { useOverview } from '@/lib/overview-context'
import { filterGoalscorers, getFlagEmoji, getTournamentGroups } from '@/lib/teams'
import { getUserErrorMessage } from '@/lib/user-error'

export function EntriesPage() {
  const { overview } = useOverview()

  return (
    <section className="space-y-7">
      <EntryEditor overview={overview} />
      <OtherEntries overview={overview} />
    </section>
  )
}

function EntryEditor({ overview }: { overview: Overview }) {
  const queryClient = useQueryClient()
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(
    overview.currentEntry?.teamPickIds ?? [],
  )
  const [goalscorerPickIds, setGoalscorerPickIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      overview.currentEntry?.goalscorerPickIds.map((pick) => [
        pick.tierId,
        pick.eligiblePlayerId,
      ]) ?? [],
    ),
  )
  const [goalscorerSearchByTier, setGoalscorerSearchByTier] = useState<Record<string, string>>({})
  const [showTournamentGroups, setShowTournamentGroups] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const saveEntryMutation = useMutation({
    mutationFn: () =>
      saveEntry(
        selectedTeamIds,
        Object.entries(goalscorerPickIds)
          .filter(([, eligiblePlayerId]) => eligiblePlayerId !== '')
          .map(([tierId, eligiblePlayerId]) => ({ tierId, eligiblePlayerId })),
      ),
    onSuccess: async () => {
      const nextOverview = await queryClient.fetchQuery({
        ...overviewQueryOptions,
        staleTime: 0,
      })

      if (nextOverview) {
        queryClient.setQueryData(overviewQueryKey, nextOverview)
      }

      toast.success('Entrada guardada', {
        description: 'Tu apuesta se ha actualizado correctamente.',
      })
    },
    onError: (error) => {
      toast.error('No se ha podido guardar', {
        description: getUserErrorMessage(error),
      })
    },
  })
  const isLocked = overview.pool.status !== 'open' || overview.pool.entryLockAt <= now
  const tournamentGroups = useMemo(() => getTournamentGroups(overview), [overview])
  const totalPicks = overview.teamTiers.reduce((acc, tier) => acc + tier.requiredPicks, 0)
  const pickedTeams = selectedTeamIds.length
  const pickedGoalscorers = Object.values(goalscorerPickIds).filter(Boolean).length
  const lockDateLabel = formatEntryLockDate(overview.pool.entryLockAt)
  const progress = Math.min(
    100,
    Math.round(
      ((pickedTeams + pickedGoalscorers) / (totalPicks + overview.teamTiers.length)) * 100,
    ),
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(overview.pool.entryLockAt - Date.now(), 0),
    )
    return () => window.clearTimeout(timeoutId)
  }, [overview.pool.entryLockAt])

  function toggleTeam(teamId: string, requiredPicks: number, tierTeamIds: string[]) {
    setSelectedTeamIds((current) => {
      if (current.includes(teamId)) {
        return current.filter((id) => id !== teamId)
      }

      const pickedInTier = current.filter((id) => tierTeamIds.includes(id))

      if (pickedInTier.length < requiredPicks) {
        return [...current, teamId]
      }

      const [oldestPick] = pickedInTier
      return [...current.filter((id) => id !== oldestPick), teamId]
    })
  }

  function handleSave() {
    saveEntryMutation.mutate()
  }

  return (
    <section className="space-y-6">
      <header className="entries-hero">
        <div>
          <h2 className="display-title text-3xl leading-[0.95]">Haz tu apuesta</h2>
          <p className="mt-1.5 text-sm font-semibold opacity-75">
            {pickedTeams}/{totalPicks} selecciones · {pickedGoalscorers}/{overview.teamTiers.length}{' '}
            goleadores
          </p>
        </div>
        <div className="entries-hero-stamp" aria-hidden="true">
          <div className="entries-hero-stamp-content">
            <span className="entries-hero-num">{progress}</span>
            <span className="entries-hero-unit">%</span>
          </div>
        </div>
        <div
          className="entries-hero-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="entries-hero-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="entry-lock-notice">
        <div className="entry-lock-notice-icon" aria-hidden="true">
          <CalendarClock className="size-4" />
        </div>
        <p>
          <span>La porra cierra el {lockDateLabel}.</span>{' '}
          <span>Después de enviarla puedes modificarla hasta el cierre.</span>
        </p>
      </div>

      {overview.teamTiers.length === 0 ? (
        <p className="rounded-2xl border bg-surface px-4 py-3 text-sm text-ink-soft">
          Todavía no hay bombos configurados.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="section-label">Selecciones</div>
            <button
              type="button"
              onClick={() => setShowTournamentGroups((current) => !current)}
              className="pill"
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              {showTournamentGroups ? 'Ocultar grupos' : 'Ver grupos'}
            </button>
          </div>
          {showTournamentGroups ? <TournamentGroups groups={tournamentGroups} /> : null}
          <div className="space-y-4">
            {overview.teamTiers.map((tier) => {
              const tierTeamIds = tier.teams.map((team) => team.id)
              const pickedInTier = selectedTeamIds.filter((id) => tierTeamIds.includes(id)).length
              const complete = pickedInTier === tier.requiredPicks

              return (
                <article key={tier.id} className="tier-card">
                  <div className="tier-head">
                    <div className="flex items-center gap-2">
                      <span className="tier-mult">{formatMultiplier(tier.multiplier)}</span>
                      <span className="tier-tag">{tier.name}</span>
                    </div>
                    <span
                      className={`tier-counter ${complete ? 'is-complete' : ''}`}
                      aria-label={`${pickedInTier} de ${tier.requiredPicks} selecciones`}
                    >
                      {pickedInTier}/{tier.requiredPicks}
                    </span>
                  </div>
                  <div className="px-3 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {tier.teams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          className={`team-pick ${selectedTeamIds.includes(team.id) ? 'is-selected' : ''}`}
                          disabled={isLocked}
                          onClick={() => toggleTeam(team.id, tier.requiredPicks, tierTeamIds)}
                        >
                          <span className="team-flag" aria-hidden="true">
                            {getFlagEmoji(team.fifaCode)}
                          </span>
                          <span className="min-w-0 text-left">
                            <span className="block truncate font-heading text-sm font-extrabold leading-tight">
                              {team.name}
                            </span>
                            <span className="block text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
                              Grupo {team.groupCode}
                            </span>
                          </span>
                          {selectedTeamIds.includes(team.id) ? (
                            <Check className="ml-auto size-4 shrink-0" aria-hidden="true" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="section-label">Goleadores</div>
        {overview.eligiblePlayers.length === 0 ? (
          <p className="rounded-2xl border bg-surface px-4 py-3 text-sm text-ink-soft">
            Todavía no hay goleadores configurados.
          </p>
        ) : (
          <div className="space-y-4">
            {overview.teamTiers.map((tier) => {
              const selectedGoalscorerId = goalscorerPickIds[tier.id] ?? ''
              const selectedGoalscorer =
                overview.eligiblePlayers.find((player) => player.id === selectedGoalscorerId) ??
                null
              const availableGoalscorers = overview.eligiblePlayers.filter(
                (player) => player.tierId === tier.id,
              )
              const search = goalscorerSearchByTier[tier.id] ?? ''
              const filteredGoalscorers = filterGoalscorers(availableGoalscorers, search).slice(
                0,
                80,
              )

              return (
                <article key={tier.id} className="tier-card">
                  <div className="tier-head">
                    <div className="flex items-center gap-2">
                      <span className="tier-mult">{formatMultiplier(tier.multiplier)}</span>
                      <span className="tier-tag">{tier.name}</span>
                    </div>
                    {selectedGoalscorer ? (
                      <span className="pill pill-mint">
                        <Check className="size-3.5" aria-hidden="true" />
                        Elegido
                      </span>
                    ) : (
                      <span className="pill">Sin elegir</span>
                    )}
                  </div>
                  <div className="px-3 pb-4">
                    {availableGoalscorers.length === 0 ? (
                      <p className="rounded-2xl border bg-surface px-4 py-3 text-sm text-ink-soft">
                        Todavía no hay goleadores en este bombo.
                      </p>
                    ) : (
                      <Combobox.Root
                        value={selectedGoalscorerId || null}
                        itemToStringLabel={(playerId) => {
                          const player = overview.eligiblePlayers.find(
                            (candidate) => candidate.id === playerId,
                          )
                          return player ? `${player.name} · ${player.teamName}` : playerId
                        }}
                        onValueChange={(value) => {
                          setGoalscorerPickIds((current) => ({
                            ...current,
                            [tier.id]: typeof value === 'string' ? value : '',
                          }))
                          setGoalscorerSearchByTier((current) => ({ ...current, [tier.id]: '' }))
                        }}
                        inputValue={search}
                        onInputValueChange={(value) =>
                          setGoalscorerSearchByTier((current) => ({ ...current, [tier.id]: value }))
                        }
                        disabled={isLocked}
                      >
                        <div className="goalscorer-input">
                          {selectedGoalscorer ? (
                            <span className="team-flag" aria-hidden="true">
                              {getFlagEmoji(selectedGoalscorer.teamFifaCode)}
                            </span>
                          ) : (
                            <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
                          )}
                          <Combobox.Input
                            placeholder={
                              selectedGoalscorer
                                ? `${selectedGoalscorer.name} · ${selectedGoalscorer.teamName}`
                                : 'Buscar goleador…'
                            }
                          />
                        </div>
                        <Combobox.Portal>
                          <Combobox.Positioner sideOffset={6}>
                            <Combobox.Popup className="combo-popup">
                              {filteredGoalscorers.length === 0 ? (
                                <Combobox.Empty>No hay goleadores que coincidan.</Combobox.Empty>
                              ) : (
                                <Combobox.List>
                                  {filteredGoalscorers.map((player) => (
                                    <Combobox.Item key={player.id} value={player.id}>
                                      <span className="team-flag" aria-hidden="true">
                                        {getFlagEmoji(player.teamFifaCode)}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-heading text-sm font-extrabold leading-tight">
                                          {player.name}
                                        </span>
                                        <span className="block text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
                                          {player.teamName} · {player.teamFifaCode} · Gr{' '}
                                          {player.groupCode}
                                        </span>
                                      </span>
                                      {selectedGoalscorerId === player.id ? (
                                        <Check className="size-4" aria-hidden="true" />
                                      ) : null}
                                    </Combobox.Item>
                                  ))}
                                </Combobox.List>
                              )}
                            </Combobox.Popup>
                          </Combobox.Positioner>
                        </Combobox.Portal>
                        {selectedGoalscorer ? (
                          <p className="mt-2 inline-flex items-center gap-2 px-1 text-sm text-ink-soft">
                            <span className="font-heading font-extrabold text-ink">
                              {selectedGoalscorer.name}
                            </span>
                            <span className="text-ink-soft">·</span>
                            <span>{selectedGoalscorer.teamName}</span>
                          </p>
                        ) : null}
                      </Combobox.Root>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="save-cta"
        disabled={isLocked || saveEntryMutation.isPending}
        onClick={handleSave}
      >
        <Save className="size-5" aria-hidden="true" />
        {saveEntryMutation.isPending ? 'Guardando…' : 'Guardar entrada'}
      </button>
    </section>
  )
}

function OtherEntries({ overview }: { overview: Overview }) {
  const myName = overview.session.participantName
  const others = overview.leaderboard.filter((entry) => entry.participantName !== myName)
  if (others.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="section-label">La cuadrilla</div>
      <div className="space-y-3">
        {others.map((entry) => (
          <article key={entry.entryId ?? entry.participantId} className="entry-card">
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-deep text-sm font-extrabold text-ink">
                  {getInitials(entry.participantName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-extrabold">
                    {entry.participantName}
                  </p>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                    {entry.submittedAt ? 'Entrada enviada' : 'Aún sin enviar'}
                  </p>
                </div>
              </div>
              <span className="display-num text-xl text-coral-ink">
                {formatScore(entry.currentScore)}
                <span className="ml-0.5 text-[0.55rem] font-bold opacity-80">pts</span>
              </span>
            </header>
            {entry.teamPicks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {entry.teamPicks.map((pick) => (
                  <span
                    key={`${entry.entryId}-${pick.tierName}-${pick.teamName}`}
                    className="pick-chip"
                  >
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                      {pick.tierName.replace('Bombo ', 'B')}
                    </span>
                    {pick.teamName}
                  </span>
                ))}
              </div>
            ) : null}
            {entry.goalscorerPicks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {entry.goalscorerPicks.map((pick) => (
                  <span
                    key={`${entry.entryId}-${pick.tierName}-${pick.playerName}`}
                    className="pick-chip"
                  >
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                      {pick.tierName.replace('Bombo ', 'B')}
                    </span>
                    {pick.playerName}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function TournamentGroups({ groups }: { groups: ReturnType<typeof getTournamentGroups> }) {
  return (
    <div className="sticker-soft grid grid-cols-2 gap-2 p-3">
      {groups.map((group) => (
        <div key={group.groupCode} className="rounded-xl bg-paper-deep/40 p-2 text-xs">
          <p className="font-heading text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-soft">
            Grupo {group.groupCode}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {group.teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between gap-1.5 font-heading text-[0.78rem] font-bold"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="text-base leading-none" aria-hidden="true">
                    {getFlagEmoji(team.fifaCode)}
                  </span>
                  <span className="truncate">{team.name}</span>
                </span>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-soft">
                  {team.tierName.replace('Bombo ', 'B')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function formatMultiplier(value: number | null) {
  if (value === null) return '-'

  return `x${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value)}`
}

function formatScore(value: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatEntryLockDate(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
