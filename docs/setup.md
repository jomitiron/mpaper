# Setup

How to run MotoPapers locally, what each setting does, and how to set up the Azure and GitHub
side so pull requests get preview links and `main` deploys to staging and then production.

## Run it locally

You need **Node 20.19 or later** (`nvm use` reads `.nvmrc`) and **pnpm 12** (the exact version is
pinned in `package.json`; `corepack enable` picks it up).

```sh
pnpm install
pnpm --filter web dev     # the app on http://localhost:5170
pnpm --filter site dev    # the marketing site on http://localhost:4320
pnpm dev                  # both
```

The app starts with the **mock API on** (`apps/web/.env.development`), so it works without a
backend. On the sign-in page, choose **Sign in with sample data**, or once phase 1 is in, sign in as:

| Email | Password |
| --- | --- |
| `ada.okafor@example.com` | `password123` |

Ada has the four cars, wallet and payments from the design. The mock data lives in
`sessionStorage`; reset it from the browser console with `__motopapersMocks.reset()`. Codes, amounts
and other values that trigger errors are listed in `packages/api/src/mocks/README.md`.

To use the real dev API instead, create `apps/web/.env.development.local`:

```sh
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://ijanla-dev.azurewebsites.net
# Turn off flags for endpoints the backend hasn't built yet (docs/phases/api-gaps.md)
VITE_FLAG_RENEWALS=false
VITE_FLAG_REMINDER_SETTINGS=false
VITE_FLAG_TX_LABELS=false
VITE_FLAG_WALLET_PAY=false
VITE_FLAG_VERIFY_PAYMENT=false
```

The dev API has to allow `http://localhost:5170` in CORS for this to work.

### Scripts

Run from the repo root. Each also runs in a single package with `pnpm --filter <name> <script>`
(`web`, `site`, `@motopapers/api`, `@motopapers/ui`, `@motopapers/tokens`).

| Script | What it does |
| --- | --- |
| `pnpm dev` | App and site dev servers |
| `pnpm lint` | ESLint, then a Prettier check |
| `pnpm format` | Prettier, then ESLint `--fix` |
| `pnpm typecheck` | `vue-tsc`, `tsc` and `astro check` in every package |
| `pnpm test` | Vitest in every package |
| `pnpm build` | Production builds of the app (`apps/web/dist`) and site (`apps/site/dist`) |

All four of `lint`, `typecheck`, `test` and `build` must pass before a pull request; CI runs them.

### Dev server ports

Each phase session uses its own port so they can run side by side: web 5170 (phase 0), 5171–5176
for phases 1–6, site 4320 (phase 0) and 4321 (phase 5). Run on another port with
`pnpm --filter web dev --port 5171`.

## How the code is laid out

```
apps/web              Vue 3 app
  src/features/<name>/  one folder per feature, each with its own routes.ts
  src/router/           collects every features/*/routes.ts; sign-in guard; ?next= handling
  src/stores/session.ts Pinia session (phase 1 fills in the stub)
  src/lib/              API wiring, Vue Query client, shared query keys
  src/components/       app shell: sidebar, tab bar, page header
apps/site             Astro marketing site
packages/tokens       colours, fonts, radii and shadows from the design (CSS and TS)
packages/ui           shared Vue components and their CSS
packages/api          API client, Zod schemas, document reader, payment stream, status maths, mocks
```

- **Adding a page:** add it to your feature's `routes.ts`. Route `meta`: `public` (no sign-in needed),
  `guestOnly` (signed-in drivers skip it), `layout: 'bare'` (no sidebar), `title`.
- **Calling the API:** import functions from `@motopapers/api` (`listVehicles`, `createInsurance`…)
  and use them in Vue Query. Shared keys are in `src/lib/queries.ts`; invalidate `['vehicles']` after
  any change to a car or its papers. Every response is checked with Zod.
- **Errors:** a failed query shows a toast unless it has `meta: { silent: true }`; a mutation shows one
  unless it has its own `onError`. Turn errors into words with `errorMessage(error)`. A 401 signs the
  driver out and sends them to `/sign-in?next=…` by itself.
- **Status maths:** `paperStatus(expiry_date)` and `vehicleStatus(vehicle)` from `@motopapers/api`.
  Valid is more than 30 days, Due soon is 0 to 30, Expired is past the date, Not tracked is no date.
  Dates are Lagos calendar dates.
- **Formatting:** `formatNaira(8500)` → `₦8,500`, `formatDate('2026-10-20')` → `20 Oct 2026`.
- **Components:** `@motopapers/ui` (Button, Chip, StatusPill, Plate, Tile, Card, Sheet, Modal, Field,
  Input, Switch, SegmentedControl, Stepper, EmptyState, `useToast()`). Their CSS uses the design's
  class names (`.btn`, `.card`, `.tile`…), so feature markup can use them too.
- **Icons:** `@lucide/vue` (the maintained name of `lucide-vue-next`), e.g. `import { Car } from '@lucide/vue'`.

## Environment variables

Nothing in the front ends is secret: Paystack and Google keys stay on the API.

### Web app (`apps/web`)

| Variable | Local default | Preview | Staging | Production |
| --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `https://ijanla-dev.azurewebsites.net` | `https://ijanla-dev.azurewebsites.net` | `https://ijanla-stage.azurewebsites.net` | `https://ijanla.azurewebsites.net` |
| `VITE_DOC_PARSER_URL` | the production reader | same | same | same |
| `VITE_APP_URL` | `http://localhost:5170` | | `https://app-staging.<domain>` | `https://app.<domain>` |
| `VITE_SITE_URL` | `http://localhost:4320` | | `https://staging.<domain>` | `https://<domain>` |
| `VITE_USE_MOCKS` | `true` | `false` | `false` | always `false` |
| `VITE_SENTRY_DSN` | empty | | set in phase 6 | set in phase 6 |
| `VITE_FLAG_RENEWALS` | `true` | `false` | `false` | `false` |
| `VITE_FLAG_REMINDER_SETTINGS` | `true` | `false` | `false` | `false` |
| `VITE_FLAG_TX_LABELS` | `true` | `false` | `false` | `false` |
| `VITE_FLAG_WALLET_PAY` | `true` | `false` | `false` | `false` |
| `VITE_FLAG_VERIFY_PAYMENT` | `true` | `false` | `false` | `false` |

Turn a flag on in an environment once the backend ships its endpoint (see
`docs/phases/api-gaps.md`). The document reader defaults to
`https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument`.

### Marketing site (`apps/site`)

| Variable | Local default | Staging | Production |
| --- | --- | --- | --- |
| `PUBLIC_APP_URL` | `http://localhost:5170` | `https://app-staging.<domain>` | `https://app.<domain>` |
| `PUBLIC_SITE_URL` | `http://localhost:4320` | `https://staging.<domain>` | `https://<domain>` |

## Azure and GitHub setup

The deploy workflows (`.github/workflows/deploy-web.yml` and `deploy-site.yml`) do nothing until
their tokens exist, so this can be done any time. You need the Azure CLI (`az login`) and the GitHub
CLI (`gh auth login`).

### 1. Create the two Static Web Apps

One for the app, one for the site. The Standard plan is recommended for the app: it allows more
preview environments at once (the Free plan allows three, and staging uses one of them).

```sh
az group create --name motopapers --location westeurope

az staticwebapp create --name motopapers-web  --resource-group motopapers --location westeurope --sku Standard
az staticwebapp create --name motopapers-site --resource-group motopapers --location westeurope --sku Free
```

Don't connect them to GitHub in the portal: the workflows in this repo do the deploying.

### 2. Add the deploy tokens as repository secrets

```sh
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_WEB \
  --body "$(az staticwebapp secrets list --name motopapers-web --query properties.apiKey -o tsv)"
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_SITE \
  --body "$(az staticwebapp secrets list --name motopapers-site --query properties.apiKey -o tsv)"
```

These must be **repository** secrets (not environment secrets): each workflow checks for them before
deploying. Pull requests from forks don't get secrets, so they build in CI but don't deploy.

### 3. Create the GitHub environments

`preview`, `staging` and `production`. Production needs a reviewer before anything ships:

```sh
REPO=jomitiron/mpaper
for env in preview staging; do gh api -X PUT "repos/$REPO/environments/$env"; done
gh api -X PUT "repos/$REPO/environments/production" --input - <<'JSON'
{ "reviewers": [{ "type": "User", "id": <your GitHub user id> }], "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false } }
JSON
```

(Your user id: `gh api user --jq .id`.) Or do the same under Settings → Environments.

### 4. Set the variables for each environment

Set the variables in the tables above as **environment variables** (Settings → Environments →
<name> → Variables), not repository variables, so each environment gets its own API. Anything left
unset falls back to the defaults in the workflow: the right `ijanla` API for each environment, mocks
and flags off.

```sh
gh variable set PUBLIC_APP_URL --env production --body "https://app.<domain>"
gh variable set VITE_FLAG_RENEWALS --env staging --body "true"   # once the renewals API is on staging
```

### 5. Protect `main`

Require the CI check and one review:

```sh
gh api -X PUT repos/jomitiron/mpaper/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Lint, typecheck, test, build"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
```

### 6. Custom domains (at launch)

Add `app.<domain>` to `motopapers-web` and `<domain>` (plus `www`) to `motopapers-site` under
Custom domains in the Azure portal, following its DNS instructions. Custom domains attach to the
production environment of a Static Web App; staging uses the URL Azure gives the `staging`
environment. If staging must live on `app-staging.<domain>`, create a separate Static Web App for
it and change the staging job's token.

Before launch the API also needs these domains in CORS, the Google OAuth redirect URLs, and the
Paystack callback set to `https://app.<domain>/payments/callback` (see `docs/build-plan.html`).

## How deploys work

| Event | Web app and site |
| --- | --- |
| Pull request opened or updated | Built and deployed to a preview URL, posted on the PR |
| Pull request closed | Preview removed |
| Merge to `main` | Deployed to the `staging` environment, then waits for approval |
| Approval on `production` | Rebuilt with production settings and deployed to production |

Each deploy builds with its environment's variables, so the API URL and flags are baked in for that
environment. `staticwebapp.config.json` (in each app's `public/`) gives the app its SPA fallback,
redirects the old app's addresses (`/home`, `/vehicles`, `/transactions`, `/login`, `/signup`) and
sets caching headers.

Rolling back: in the Azure portal, Static Web App → Environments keeps earlier deployments; or
re-run an earlier `Deploy` workflow run from the Actions tab.

## Troubleshooting

- **`pnpm install` complains about build scripts.** pnpm 12 only runs install scripts for packages
  listed under `allowBuilds` in `pnpm-workspace.yaml`. esbuild and vue-demi are allowed; msw and
  sharp don't need theirs.
- **The mock API doesn't start.** `apps/web/public/mockServiceWorker.js` must match the installed
  MSW version. Regenerate it with `pnpm --filter web exec msw init public --no-save`.
- **Port already in use.** Another session may be on it; pass `--port`.
