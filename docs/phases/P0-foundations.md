# Phase 0 · Foundations

Branch: `phase-0/foundations` · Port: web 5170, site 4320 · Depends on: nothing · Unblocks: every other phase

## Goal
An empty app and site that build, test and deploy from the repo, with the shared pieces every other
phase builds on. Other sessions start the moment this merges, so make the seams clean.

## Build
1. **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`), root scripts `dev`, `build`, `lint`,
   `typecheck`, `test`, `format` that run across packages. `.nvmrc` (20), `.editorconfig`,
   ESLint flat config, Prettier, `tsconfig.base.json`.
2. **packages/tokens**: port every colour, font, radius and shadow from `design/motopapers-site.html`
   (`:root` block) into `tokens.css` and `tokens.ts`. Include the Google Fonts import (Gabarito, Figtree).
3. **packages/ui**: Button (coral, night, white, soft, quiet; sm/lg; loading), Chip (pressed state),
   StatusPill (ok, warn, bad, idle), Plate, Tile (doc colour variants), Card, Sheet (right drawer, focus
   trap, Esc), Modal, Toast (queue), Input/Field (label, hint, error), Switch, SegmentedControl, Stepper,
   EmptyState. Vitest tests for Sheet/Modal focus handling and Button states.
4. **packages/api**:
   - `client.ts`: fetch wrapper with base URL from env, token getter, JSON, typed errors, a 401 hook.
   - Zod schemas + functions for every documented endpoint (users, vehicles, insurance,
     insurance-companies, roadworthiness, vehicle-licenses, transactions, wallets).
   - `docReader.ts` for the document reader (see CLAUDE.md), including the label → field mapping.
   - `sse.ts`: `waitForPayment(reference)` using @microsoft/fetch-event-source with a 20 s timeout,
     then polling `GET /transactions/:id` every 3 s up to 2 min.
   - `status.ts`: `paperStatus(expiry_date, today)` → `{ state, daysLeft }`, and vehicle worst-state.
     Unit-test the date maths (timezone-safe, Africa/Lagos).
   - MSW handlers for the documented endpoints (sample data from the design: Ada Okafor, KJA 731 AE,
     EKY 219 GD, LSD 482 KJ, APP 105 BC) and for the gaps in `api-gaps.md`.
5. **apps/web** shell:
   - Vite + Vue + TS, env typing, `VITE_API_BASE_URL`, `VITE_USE_MOCKS`, `VITE_FLAG_*`.
   - Router that collects `src/features/*/routes.ts` via `import.meta.glob`; guard that redirects
     signed-out users to `/sign-in?next=`. Pinia `session` store (token, user, signOut) with a stub
     that later phases fill in.
   - App layout from the design: white pill sidebar (Home, My cars, Payments, Settings, help card,
     user row) on desktop; bottom tab bar with the coral + button on phones. Toast host.
   - Placeholder pages, one per feature folder: `features/auth`, `features/home`, `features/cars`,
     `features/payments`, `features/settings`, `features/renewals` — each with its own `routes.ts`
     and a simple "Coming in phase N" page, so owners replace only their own files.
   - Vue Query client, global error toast, 404 page.
6. **apps/site**: Astro scaffold using `packages/tokens`, a placeholder home page, `PUBLIC_APP_URL`.
7. **CI/CD**: `.github/workflows/ci.yml` (install, lint, typecheck, test, build on PRs and main).
   `deploy-web.yml` and `deploy-site.yml` for Azure Static Web Apps that only run when the
   `AZURE_STATIC_WEB_APPS_API_TOKEN_WEB` / `_SITE` secrets exist; staging on `main`, production via a
   `production` environment with required reviewers. `staticwebapp.config.json` with SPA fallback
   and the old-route redirects (`/home`→`/`, `/vehicles`→`/cars`, `/transactions`→`/payments`,
   `/login`→`/sign-in`, `/signup`→`/sign-up`).
8. **docs/setup.md**: how to run locally, env vars, how to create the Azure resources and add secrets.

## Done when
- `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes from a clean clone.
- `pnpm --filter web dev` with mocks shows the shell with all four nav items and placeholders.
- CI workflow passes on the PR.
