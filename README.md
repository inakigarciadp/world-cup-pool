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
pnpm convex dev
```

The first Convex run prompts you to sign in with GitHub, create or select a Convex project, and writes the deployment values to `.env.local`. Vite reads the Convex client URL from `VITE_CONVEX_URL` and the HTTP action URL from `VITE_CONVEX_SITE_URL`.

Set the Convex auth environment variables before using participant login:

```bash
pnpm convex env set AUTH_JWT_SECRET "$(openssl rand -base64 48)"
pnpm convex env set SITE_ORIGIN "http://localhost:5173"
```

`AUTH_JWT_SECRET` signs the short-lived access JWT and long-lived refresh JWT. `SITE_ORIGIN` should match the frontend origin that is allowed to send credentialed requests.

## Scripts

- `pnpm dev`: run the Vite dev server.
- `pnpm convex dev`: link/sync the Convex backend and generate Convex client types.
- `pnpm build`: type-check and build the frontend.
- `pnpm lint`: run ESLint.
- `pnpm users:add <username> [--admin]`: add a local participant row under `data/users.csv`.
- `pnpm users:sync:dev`: hash local PINs and sync participants to the dev Convex deployment.
- `pnpm users:sync:prod`: hash local PINs and sync participants to the prod Convex deployment.

## Notes

The app uses custom participant auth rather than Convex Auth. PINs are hashed before they are stored in Convex, and browser sessions are held in `HttpOnly` cookies containing short-lived access JWTs plus rotating refresh JWTs.
