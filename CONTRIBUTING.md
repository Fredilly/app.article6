# Contributing to app.article6

Thanks for helping improve the Article 6 demo. This project uses Next.js 15 with npm and Node 20.

## Prerequisites

- Node 20.x (project ships an `.nvmrc`; run `nvm use` to activate the right version).
- npm 10+ (bundled with Node 20).
- Local `.env.local` file containing at minimum:
  ```env
  ENGINE_URL=https://engine.example.com
  ENGINE_BEARER=Bearer <token> # optional if engine needs auth
  NEXT_PUBLIC_ENGINE_TAG=local-dev
  NEXT_PUBLIC_ENABLE_AUDIT=true
  ```
  Omit `ENGINE_URL` and set `ENGINE_ADAPTER=demo` to exercise the built-in demo adapter.

## Install & run locally

```bash
npm install
npm run dev
```

This launches the app at http://localhost:3000. The `/audit` route is guarded behind `NEXT_PUBLIC_ENABLE_AUDIT`.

## Linting & tests

```bash
npm run lint
npm run test
```

CI mirrors these commands (see `.github/workflows`). Ensure they pass before you submit a PR.

## Connecting to the engine

Set `ENGINE_URL` to your engine’s base URL; the app automatically POSTs `/query`. If bearer auth is required, set `ENGINE_BEARER`. Preview deployments often run behind Vercel Protection—follow the README “Preview protection & bypass cookie” instructions to mint the bypass cookie before calling APIs.

## Pull requests

1. Create a feature branch from `main`.
2. Commit logically grouped changes with clear messages.
3. Run lint + tests.
4. If you add environment variables, document them in the README.
5. Open a PR following the project template (describe What/Why/Testing and sign off `Signed-off-by: you@example.com`).

Thanks again for contributing!
