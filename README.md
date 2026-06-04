# World Cup Pool

A private friends-only World Cup prediction pool built with React, Vite, TypeScript, shadcn/ui with Base UI, and Convex.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Start the frontend only:

```bash
pnpm dev
```

Link and run Convex:

```bash
pnpm dev:convex
```

The first Convex run prompts you to sign in with GitHub, create or select a Convex project, and writes the deployment values to `.env.local`. Vite reads the Convex client URL from `VITE_CONVEX_URL` and the HTTP action URL from `VITE_CONVEX_SITE_URL`.

Local development calls the Convex HTTP action URL directly. Production is different: the Vite bundle calls `/auth/*` and `/api/*` on the Vercel origin, and `vercel.ts` proxies those paths to the production Convex site URL so browser auth cookies stay first-party.

Set the Convex auth environment variables before using participant login:

```bash
pnpm exec convex env set AUTH_JWT_SECRET "$(openssl rand -base64 48)"
pnpm exec convex env set SITE_ORIGINS "http://localhost:5173"
```

`AUTH_JWT_SECRET` signs the short-lived access JWT and long-lived refresh JWT. `SITE_ORIGINS` is a comma-separated allowlist of frontend origins that can send credentialed requests to Convex HTTP actions. `SITE_ORIGIN` is still supported for one origin, but new setup should use `SITE_ORIGINS`.

Script-only admin mutations require a shared secret. Store separate local values for dev and prod in `.env.local`, and set the matching value in each Convex deployment as `ADMIN_SCRIPT_SECRET`:

```bash
CONVEX_DEV_ADMIN_SCRIPT_SECRET=<dev script secret>
CONVEX_PROD_ADMIN_SCRIPT_SECRET=<prod script secret>
# Optional: use a concrete production deployment name instead of the `prod` alias.
CONVEX_PROD_DEPLOYMENT=

set -a; source .env.local; set +a
pnpm exec convex env set ADMIN_SCRIPT_SECRET "$CONVEX_DEV_ADMIN_SCRIPT_SECRET" --deployment dev
pnpm exec convex env set ADMIN_SCRIPT_SECRET "$CONVEX_PROD_ADMIN_SCRIPT_SECRET" --deployment prod
```

The local import/sync scripts read `.env.local` and choose the right secret from `--deployment dev|prod`.

## Production Deploy

The first production deploy uses Vercel for the Vite frontend and the Convex production deployment for the backend.

1. Push the repo to GitHub, GitLab, or Bitbucket.

2. Open the Convex dashboard at <https://dashboard.convex.dev>, select this project, then select the production deployment.

3. Generate or copy a production deploy key from the production deployment settings. In the Convex dashboard this is under the deployment settings for URL/deploy keys.

4. Import the repo into Vercel.

   Use these project settings:

   ```text
   Framework Preset: Vite
   Root Directory: .
   Build Command: pnpm vercel-build
   Output Directory: dist
   ```

   Do not manually set `VITE_CONVEX_URL` in Vercel. The Convex deploy command injects it into
   the Vite build. Preview builds also derive `VITE_CONVEX_SITE_URL` from that generated URL.

   Set the production Convex HTTP action URL as a Vercel environment variable:

   ```text
   CONVEX_SITE_URL_FOR_PROXY=https://colorless-bandicoot-167.eu-west-1.convex.site
   ```

   `vercel.ts` reads this value at deploy time and proxies `/auth/*` and `/api/*` to that Convex site URL.

   This same-origin proxy is required for reliable login on iPhone browsers. Safari and Chrome on iPhone both use WebKit and can reject the cross-site cookie flow when the frontend calls `*.convex.site` directly.

5. Add Convex deploy keys to Vercel.

   In Vercel project settings, add this environment variable for the production environment:

   ```text
   CONVEX_DEPLOY_KEY=<production deploy key from Convex>
   ```

   Add the same variable for the preview environment, but use a Convex preview deploy key:

   ```text
   CONVEX_DEPLOY_KEY=<preview deploy key from Convex>
   ```

   With a preview deploy key, `pnpm vercel-build` creates a branch-scoped Convex preview
   deployment, deploys the Convex functions, builds the frontend against that preview deployment,
   and runs `pools:seedPreview` only when a new preview deployment is created.

6. Deploy from Vercel.

   Vercel runs the build command above, which deploys Convex functions and builds the static frontend into `dist`.

7. Copy the production Vercel URL, for example:

   ```text
   https://your-project.vercel.app
   ```

8. Set the required Convex production environment variables.

   Use the Convex dashboard on the production deployment, or run:

   ```bash
   pnpm exec convex env set AUTH_JWT_SECRET "$(openssl rand -base64 48)" --prod
   pnpm exec convex env set SITE_ORIGINS "https://your-project.vercel.app" --prod
   pnpm exec convex env set ADMIN_SCRIPT_SECRET "$CONVEX_PROD_ADMIN_SCRIPT_SECRET" --prod
   ```

   If the app later uses a custom domain, allow both origins until traffic has moved:

   ```bash
   pnpm exec convex env set SITE_ORIGINS "https://your-project.vercel.app,https://your-domain.com" --prod
   ```

9. Seed production data.

   Make sure `data/users.csv` contains the participants you want to invite, then sync users and base pool data:

   ```bash
   pnpm users:sync:prod
   ```

   Dry-run the public FIFA imports first:

   ```bash
   pnpm players:import:fifa
   pnpm matches:import:fifa
   ```

   Then import players and matches into production:

   ```bash
   pnpm players:import:fifa:prod
   pnpm matches:import:fifa:prod
   ```

10. Verify the deployment.

    Open the Vercel URL, log in with a participant from `data/users.csv`, and check the Convex production dashboard for expected rows in `pools`, `participants`, `teams`, `teamTiers`, `eligiblePlayers`, and `matches`.

The final rewrite in `vercel.ts` is the SPA fallback. Keep it after the `/auth/*` and `/api/*` rewrites so nested frontend routes such as `/entries` work without swallowing backend requests.

## Vercel Preview Deployments

Convex preview deployments are fresh backends and do not share production or development data.
The preview setup uses the same Vercel build command as production:

```text
Build Command: pnpm vercel-build
```

In Vercel, make sure `CONVEX_DEPLOY_KEY` is set for Preview only with the Convex preview deploy
key. Keep the production deploy key scoped to Production only.

Set these Convex default environment variables for preview deployments in the Convex dashboard:

```text
AUTH_JWT_SECRET=<at least 32 random characters>
SITE_ORIGIN_SUFFIXES=vercel.app
```

`SITE_ORIGIN_SUFFIXES=vercel.app` lets branch preview URLs call Convex HTTP actions with
credentialed CORS. Production should still use exact `SITE_ORIGINS` values and the
`CONVEX_SITE_URL_FOR_PROXY` Vercel variable for same-origin API rewrites.

When a new preview backend is created, `pools:seedPreview` inserts the base pool, teams, sample
eligible players, invented preview matches (including upcoming matches and seeded results/goals),
and demo users:

```text
admin / preview-admin
jugador-uno / preview-uno
jugador-dos / preview-dos
jugador-tres / preview-tres
```

## Scripts

- `pnpm dev`: run the Vite dev server.
- `pnpm dev:convex`: link/sync the Convex backend and generate Convex client types.
- `pnpm build`: type-check and build the frontend.
- `pnpm lint`: run ESLint.
- `pnpm lint:fix`: run ESLint with automatic fixes.
- `pnpm fmt`: format the repo.
- `pnpm fmt:check`: check repo formatting.
- `pnpm preview`: preview the production Vite build locally.
- `pnpm players:import:fifa`: dry-run the FIFA eligible-player import.
- `pnpm players:import:fifa:dev`: import FIFA eligible players into the dev Convex deployment.
- `pnpm players:import:fifa:prod`: import FIFA eligible players into the prod Convex deployment.
- `pnpm matches:import:fifa`: dry-run the FIFA match import.
- `pnpm matches:import:fifa:dev`: import FIFA matches into the dev Convex deployment.
- `pnpm matches:import:fifa:prod`: import FIFA matches into the prod Convex deployment.
- `pnpm matches:seed-results:dev`: seed deterministic full-tournament results, goals, and top scorer confirmations in the dev Convex deployment.
- `pnpm users:add <username> [--admin]`: add a local participant row under `data/users.csv`.
- `pnpm users:sync:dev`: hash local PINs and sync participants to the dev Convex deployment.
- `pnpm users:sync:prod`: hash local PINs and sync participants to the prod Convex deployment.

## Notes

The app uses custom participant auth rather than Convex Auth. PINs are hashed before they are stored in Convex, and browser sessions are held in `HttpOnly` cookies containing short-lived access JWTs plus rotating refresh JWTs.

In local dev these cookies are set by the dev Convex site URL from `.env.local`. In production they are set through Vercel's same-origin proxy to the production Convex site URL configured in Vercel as `CONVEX_SITE_URL_FOR_PROXY`.
