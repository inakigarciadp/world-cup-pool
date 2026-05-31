import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ListChecks, Save, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { saveEntry, type Overview } from '@/lib/httpApi'
import { overviewQueryKey, overviewQueryOptions } from '@/lib/overview-query'
import { useOverview } from '@/lib/overview-context'
import { filterGoalscorers, getFlagEmoji, getTournamentGroups } from '@/lib/teams'

export function EntriesPage() {
  const { overview } = useOverview()

  return (
    <section className="space-y-5">
      <EntryEditor overview={overview} />
      <div className="grid gap-4 md:grid-cols-2">
        {overview.leaderboard.map((entry) => (
          <Card key={entry.entryId}>
            <CardHeader>
              <CardTitle>{entry.participantName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Goleador elegido</p>
                <p className="font-medium">{entry.goalscorerPick ?? 'Sin elegir'}</p>
              </div>
              <div className="space-y-2">
                {entry.teamPicks.map((pick) => (
                  <div
                    key={`${entry.entryId}-${pick.tierName}-${pick.teamName}`}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="text-muted-foreground">{pick.tierName}</span>
                    <span className="font-medium">{pick.teamName}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function EntryEditor({ overview }: { overview: Overview }) {
  const queryClient = useQueryClient()
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(
    overview.currentEntry?.teamPickIds ?? [],
  )
  const [goalscorerPickId, setGoalscorerPickId] = useState(
    overview.currentEntry?.goalscorerPickId ?? '',
  )
  const [goalscorerSearch, setGoalscorerSearch] = useState('')
  const [showTournamentGroups, setShowTournamentGroups] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const saveEntryMutation = useMutation({
    mutationFn: () => saveEntry(selectedTeamIds, goalscorerPickId || null),
    onSuccess: async () => {
      const nextOverview = await queryClient.fetchQuery({
        ...overviewQueryOptions,
        staleTime: 0,
      })

      if (nextOverview) {
        queryClient.setQueryData(overviewQueryKey, nextOverview)
      }
    },
  })
  const isLocked = overview.pool.status !== 'open' || overview.pool.entryLockAt <= now
  const selectedGoalscorer =
    overview.eligiblePlayers.find((player) => player.id === goalscorerPickId) ?? null
  const filteredGoalscorers = useMemo(
    () => filterGoalscorers(overview.eligiblePlayers, goalscorerSearch).slice(0, 80),
    [goalscorerSearch, overview.eligiblePlayers],
  )
  const tournamentGroups = useMemo(() => getTournamentGroups(overview), [overview])

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
    <section className="entry-editor space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Tu jugada
        </p>
        <h2 className="text-2xl font-black">Mi entrada</h2>
      </div>
      {overview.teamTiers.length === 0 ? (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Todavía no hay bombos configurados.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTournamentGroups((current) => !current)}
            >
              <ListChecks className="size-4" aria-hidden="true" />
              {showTournamentGroups ? 'Ocultar grupos' : 'Ver grupos'}
            </Button>
          </div>
          {showTournamentGroups ? <TournamentGroups groups={tournamentGroups} /> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.teamTiers.map((tier) => {
              const tierTeamIds = tier.teams.map((team) => team.id)
              const pickedInTier = selectedTeamIds.filter((id) => tierTeamIds.includes(id)).length

              return (
                <div key={tier.id} className="tier-block space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-black">{tier.name}</p>
                    <p
                      className={
                        pickedInTier === tier.requiredPicks
                          ? 'pick-counter is-complete'
                          : 'pick-counter'
                      }
                    >
                      {pickedInTier}/{tier.requiredPicks}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tier.teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className={`team-pick ${selectedTeamIds.includes(team.id) ? 'is-selected' : ''}`}
                        disabled={isLocked}
                        onClick={() => toggleTeam(team.id, tier.requiredPicks, tierTeamIds)}
                      >
                        <span className="text-lg leading-none" aria-hidden="true">
                          {getFlagEmoji(team.fifaCode)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{team.name}</span>
                          <span className="text-xs opacity-75">Grupo {team.groupCode}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="space-y-3">
        <p className="text-sm font-medium">Goleador elegido</p>
        {overview.eligiblePlayers.length === 0 ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Todavía no hay goleadores configurados.
          </p>
        ) : (
          <Combobox.Root
            value={goalscorerPickId || null}
            onValueChange={(value) => {
              setGoalscorerPickId(typeof value === 'string' ? value : '')
              setGoalscorerSearch('')
            }}
            inputValue={goalscorerSearch}
            onInputValueChange={setGoalscorerSearch}
            disabled={isLocked}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Combobox.Input
                className="pl-9"
                placeholder={
                  selectedGoalscorer
                    ? `${selectedGoalscorer.name} · ${selectedGoalscorer.teamName}`
                    : 'Buscar goleador o selección'
                }
              />
            </div>
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={6}>
                <Combobox.Popup>
                  {filteredGoalscorers.length === 0 ? (
                    <Combobox.Empty>No hay goleadores que coincidan.</Combobox.Empty>
                  ) : (
                    <Combobox.List>
                      {filteredGoalscorers.map((player) => (
                        <Combobox.Item key={player.id} value={player.id}>
                          <span className="text-lg leading-none" aria-hidden="true">
                            {getFlagEmoji(player.teamFifaCode)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{player.name}</span>
                            <span className="block truncate text-xs opacity-75">
                              {player.teamName} · {player.teamFifaCode} · Grupo {player.groupCode}
                            </span>
                          </span>
                          {goalscorerPickId === player.id ? (
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
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg leading-none" aria-hidden="true">
                  {getFlagEmoji(selectedGoalscorer.teamFifaCode)}
                </span>
                Seleccionado:{' '}
                <span className="font-medium text-foreground">{selectedGoalscorer.name}</span>
              </p>
            ) : null}
          </Combobox.Root>
        )}
      </div>
      {saveEntryMutation.error ? (
        <p className="text-sm text-destructive">
          {saveEntryMutation.error instanceof Error
            ? saveEntryMutation.error.message
            : 'No se ha podido guardar la entrada.'}
        </p>
      ) : null}
      <Button
        className="save-button"
        type="button"
        disabled={isLocked || saveEntryMutation.isPending}
        onClick={handleSave}
      >
        <Save className="size-4" aria-hidden="true" />
        {saveEntryMutation.isPending ? 'Guardando...' : 'Guardar entrada'}
      </Button>
    </section>
  )
}

function TournamentGroups({ groups }: { groups: ReturnType<typeof getTournamentGroups> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <div key={group.groupCode} className="group-block text-sm">
          <p className="font-black">Grupo {group.groupCode}</p>
          <div className="mt-3 space-y-2">
            {group.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-lg leading-none" aria-hidden="true">
                    {getFlagEmoji(team.fifaCode)}
                  </span>
                  <span className="truncate font-medium">{team.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{team.tierName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
