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

The first Convex run prompts you to sign in with GitHub, create or select a Convex project, and writes the deployment values to `.env.local`. Vite reads the frontend URL from `VITE_CONVEX_URL`.

## Scripts

- `pnpm dev`: run the Vite dev server.
- `pnpm convex dev`: link/sync the Convex backend and generate Convex client types.
- `pnpm build`: type-check and build the frontend.
- `pnpm lint`: run ESLint.

## Notes

Convex Auth is not required for the dev server. The current product language points toward app-specific Participant/Admin PIN login, so authentication should be designed when that flow is implemented.
