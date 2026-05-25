# Use Convex for the Backend

We will use Convex for the pool's backend, database, server-side functions, and scheduled data sync. This was chosen over Vercel plus Neon because the app is small, friends-only, reactive, admin-driven, and benefits from keeping persistence, backend logic, and cron jobs in one place on a free tier.

## Considered Options

- Vercel plus Neon Postgres
- Convex

## Consequences

The frontend remains a standard mobile-first web app, but backend code and data modeling will be shaped around Convex rather than SQL/Postgres.
