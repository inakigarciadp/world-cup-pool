# Materialized Projections for Hot Read Paths

The Leaderboard page, Entries page, and Matches page read across most Pool
tables to assemble public payloads. Those pages are expected to be visited
repeatedly during the tournament, while the source facts change only through
bounded Admin or Entry writes.

Store three read models in Convex:

- one `leaderboardProjections` document per Pool containing the public
  Leaderboard payload
- one `entriesProjections` document per Pool containing the public Entries page
  payload and per-Participant current Entry pick ids
- one `matchProjections` document per Match containing the public match-card
  payload and the Participant ids with Match Stakes

Writes that change scoring, Entry picks, Match teams, Match results, Match
Goals, Top Scorer Confirmations, imported Matches, or imported Eligible Players
refresh the affected projections synchronously for this small single-Pool app.
Admins also get a manual recompute action as a repair path after deploys or
imports.

This trades extra write work and duplicated public payload storage for cheaper
hot reads and simpler page-level data loading. The source tables remain the
system of record; projections can be rebuilt at any time.
