# MotoPapers rebuild — instructions for every session

You are one of several Claude sessions building MotoPapers in parallel. A manager session started you,
watches your progress file, and merges your pull request. Stay inside your phase.

## Read first
- `docs/phases/<your phase>.md` — your scope, the files you own, and "done when".
- `design/motopapers-site.html` — the approved design (Direction C). Match it: copy, layout, colours,
  spacing, states. Open it in a browser or read the source; every screen is in it.
- `docs/build-plan.html` — the full plan (architecture, endpoint map, backend gaps, payments flow).
- API docs: https://omitirand.gitbook.io/motorpapers-api/ — append `.md` to any page for markdown
  (`users.md`, `vehicles.md`, `insurance.md`, `insurance-companies.md`, `roadworthiness.md`,
  `vehicle-licenses.md`, `transactions.md`, `wallets.md`).

## Stack (do not change without the manager)
- pnpm workspaces, Node 20+, TypeScript strict everywhere.
- `apps/web`: Vue 3 + Vite, Vue Router, Pinia (session only), @tanstack/vue-query (server data),
  Zod (validate every API response), lucide-vue-next icons, plain CSS with tokens (no Tailwind).
- `apps/site`: Astro, static output, shares `packages/tokens`.
- `packages/tokens`: `tokens.css` (CSS variables) + `tokens.ts`. Values come from the design file.
- `packages/ui`: shared Vue components (Button, Chip, StatusPill, Plate, Tile, Card, Sheet, Modal,
  Toast, Input, Switch, Stepper…).
- `packages/api`: fetch client, Zod schemas, one module per API area, document-reader client,
  SSE helper using @microsoft/fetch-event-source (EventSource can't send the Authorization header).
- Tests: Vitest + @vue/test-utils. Mocks: MSW, on when `VITE_USE_MOCKS=true`. E2E: Playwright (phase 6).
- Lint/format: ESLint flat config + Prettier. Typecheck: vue-tsc.

## API facts
- Base URLs: `https://ijanla-dev.azurewebsites.net`, `https://ijanla-stage.azurewebsites.net`,
  `https://ijanla.azurewebsites.net` via `VITE_API_BASE_URL`. Auth: `Authorization: Bearer <token>`.
  Responses look like `{ status, message, data, meta? }`.
- Tokens expire after 30 minutes and there's no refresh endpoint yet: on 401, clear the session and send
  the driver to `/sign-in?next=<path>`.
- Paper endpoints are singular: `/vehicle/:id/insurance|roadworthiness|vehicle-licenses`.
  Vehicles are plural: `/vehicles`. `GET /vehicles` includes the current `vehicle_license`,
  `insurance` and `roadworthiness` (or null).
- Document reader (not in the docs): `POST https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument`
  body `{ "DOCUMENT_TYPE": "VEHICLE_LICENSE", "DOCUMENT": "<base64>" }`, no token, max 4 MB. Response keys
  are licence labels with `.content`: "Registration Number"→plate_number, "Vehicle Make"→brand,
  "Vehicle Model"→model, "Vehicle Color"→color, "Engine Number"→engine_number, "Chassis Number"→
  chassis_number, "Engine Capacity"→engine_capacity, "Expiry Date"/"PIN"→licence record. Convert PDFs
  to an image in the browser first.
- Missing endpoints (renewals, pay from wallet, transaction labels, GET /users/me, notification
  preferences, pricing, verify pending payment): build against MSW mocks with the shapes in
  `docs/phases/api-gaps.md`, behind `VITE_FLAG_*` flags. Never invent behaviour for real endpoints.

## Product rules
- Statuses: Valid (> 30 days), Due soon (≤ 30 days), Expired (< 0), Not tracked (null). Colours per
  paper: sky = licence, mint = insurance, butter = roadworthiness. Red/coral alert = expired only.
- Pages: Home `/`, My cars `/cars`, Add a car `/cars/new`, car panel `/cars/:id` (opens as a sheet),
  Payments `/payments`, payment return `/payments/callback`, Settings `/settings`, `/sign-in`,
  `/sign-up`, `/forgot-password`, `/reset-password`.
- Copy: plain, specific, from the design. Money as `₦8,500`. Dates as `20 Oct 2026`.
- Accessibility: real buttons and links, labels on every input, visible focus, AA contrast.

## How the web app is wired (from phase 0)
- Each feature lives in `apps/web/src/features/<name>/` with its own `routes.ts`; the router collects
  them with `import.meta.glob`, so you never edit a shared router file.
- Shared layout, nav and placeholders come from phase 0. Replace your own feature's placeholder page.

## Working rules
- Work only in your git worktree and on your branch `phase-N/<slug>`. Commit small and often
  (conventional commits). Rebase on `origin/main` before opening the PR.
- Use your assigned dev-server port (see your phase file) so parallel sessions don't collide.
- Don't edit files another phase owns. If you must, keep the change tiny and say so in the PR.
- Never commit secrets. The repo is public.
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass.
- Finish by pushing your branch and opening a PR to `main` with `gh pr create` (title
  `Phase N: <name>`, body lists what's done, what's mocked, and anything for the manager). End the PR
  body with: 🤖 Generated with [Claude Code](https://claude.com/claude-code). Do not merge it.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Progress file (the manager reads this)
Keep `progress/PN.md` (in your worktree) up to date after every meaningful step:

```
# PN · <name>
Status: starting | in-progress | blocked | done
Updated: <ISO timestamp>
PR: <url or ->

## Done
- …
## Next
- …
## Blockers / questions for the manager
- …
```
Set `Status: blocked` and write the question if you can't continue. Set `Status: done` only after the
PR is open and checks pass locally.
