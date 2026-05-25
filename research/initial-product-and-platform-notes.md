# Initial Product and Platform Notes

These notes capture decisions and research from the initial planning session that are not part of the domain glossary in `CONTEXT.md`.

## Source Format

The initial pool format comes from `/home/igpozo/Downloads/PORRA EUROCOPA .pdf`, a one-page Euro 2024 pool document. Its mechanics are:

- select teams by tier, initially 1 from tier 1, 3 from tier 2, and 3 from tier 3
- select one goalscorer
- score selected teams from match outcomes and advancement
- score the goalscorer by goals, with an extra bonus if they finish as tournament top scorer

The World Cup version should keep the same general shape but use configurable team tiers, configurable pick counts, and configurable stage bonuses so the 2026 format can be balanced later.

## Product Shape

The app will be a standard mobile-first web app, not a native mobile app and not a PWA for now. This avoids iOS signing/distribution complexity and keeps access simple for a small private group.

The leaderboard should be the primary recurring surface once the tournament is running. Before the tournament starts, participants also need fast access to create and edit their entry.

## Frontend

Use React, Vite, and TypeScript. This matches Convex's straightforward client-side React workflow and avoids unnecessary server-rendering complexity for a private interactive app.

## Backend and Hosting

Use Convex for backend functions, database, and scheduled sync. This replaces the earlier Vercel plus Neon Postgres idea because this app benefits from having persistence, backend logic, reactive updates, and cron jobs in one place.

Relevant Convex free-tier findings from May 25, 2026:

- Free/Starter supports database, auth, crons, Node.js actions, preview deployments, selectable data region, and 1-6 developers.
- Free database storage is listed as 0.5 GB total.
- Free database I/O is listed as 1 GB/month total.
- Free action compute is listed as 20 GB-hours/month total.
- Free plan overages can return errors instead of billing, which fits the zero-budget constraint but means usage should stay simple.

Sources checked:

- https://www.convex.dev/pricing
- https://docs.convex.dev/production/state/limits
- https://docs.convex.dev/scheduling/cron-jobs
- https://docs.convex.dev/auth/convex-auth

## Tournament Data Sync

Use a hybrid model: external tournament data can update scores automatically, and admin overrides take precedence when synced data is missing, late, or wrong.

Convex cron jobs should be the first choice for scheduled sync because they are built into the selected backend platform. GitHub Actions remains a fallback option if an external workflow is later useful.

Football data API candidates reviewed:

- football-data.org: free tier includes World Cup coverage, fixtures/results/standings/scorers, and appears to be the best first candidate.
- API-Football: broader endpoints, but the free plan is limited to 100 requests/day.

Sources checked:

- https://www.football-data.org/coverage
- https://www.api-football.com/pricing
- https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Authentication

Use a custom lightweight participant login model based on pre-created participant names and password-like PINs. PINs are not limited to digits.

Convex Auth exists and supports password auth, but it is currently documented as beta. Given the custom "admin pre-creates participants" workflow and small user count, implementing app-specific session auth may be simpler than adopting full Convex Auth. This should be revisited during implementation if Convex Auth fits cleanly.

## Open Product Questions

- Exact World Cup 2026 team tiers.
- Exact number of teams selected from each tier after tier balancing.
- Exact per-stage bonus values.
- Goalscorer scoring values for ordinary goals and tournament top scorer bonus.
- Whether to display leaderboard first immediately after login or switch the default screen depending on tournament phase.
