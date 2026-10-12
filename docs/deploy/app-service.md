# Deploying to the meminiNode App Service

One zip serves both halves of MotoPapers from the existing **meminiNode** App Service (Linux, Node):

- the marketing site at `/` (`https://motorpapers.com`)
- the web app at `/app/` (`https://motorpapers.com/app/`)

Releases go **dev → stage → swap into production**, so the same zip has to work in every slot.
Nothing that differs between slots is baked into it: the API address, Sentry and the feature
flags come from each slot's App Service settings when the server starts, and reach the app
through `/app/config.js`.

Related: `docs/launch/runbook.md` (Paystack, Google, CORS and the launch checklist),
`apps/server/server.mjs` (the server), `scripts/package-appservice.mjs` (the build).

## Contents

1. [Slots](#1-slots)
2. [What's in the package](#2-whats-in-the-package)
3. [One-time setup per slot](#3-one-time-setup-per-slot)
4. [App settings](#4-app-settings)
5. [Build and deploy](#5-build-and-deploy)
6. [Smoke test](#6-smoke-test)
7. [Swap into production, and rollback](#7-swap-into-production-and-rollback)
8. [Pointing the backend at the new addresses](#8-pointing-the-backend-at-the-new-addresses)
9. [What the server does](#9-what-the-server-does)
10. [Troubleshooting](#10-troubleshooting)

## 1. Slots

| Slot | Address | API |
| --- | --- | --- |
| dev | `memininode-dev.azurewebsites.net` | `https://ijanla-dev.azurewebsites.net` |
| stage | `memininode-stage.azurewebsites.net` | `https://ijanla.azurewebsites.net` |
| production | `motorpapers.com`, `www.motorpapers.com`, `memininode.azurewebsites.net` | `https://ijanla.azurewebsites.net` |

Stage talks to the **production API**: anything you do there (sign-ups, payments) is real.

Resource group `ReminderServicerRG`, app `meminiNode`.

## 2. What's in the package

`pnpm package:appservice` writes `dist-appservice/` and zips it to `dist-appservice.zip` (both
git-ignored):

| Path | What |
| --- | --- |
| `server.mjs` | The server (`apps/server`). Node built-ins only: the deploy needs no `npm install`. |
| `package.json` | `"type": "module"`, `"start": "node server.mjs"`, no dependencies, `engines.node >=20`. |
| `site/` | The Astro site, built with `PUBLIC_APP_URL=/app` (every "Sign in" and "Get started" goes to `/app/…`) and `PUBLIC_SITE_URL` (default `https://motorpapers.com`, for canonical links and the sitemap). |
| `web/` | The Vue app, built with `WEB_BASE=/app/`, the mock API off and no API address. |

The release (for Sentry) is the commit the zip was built from (`git rev-parse HEAD`), or
`RELEASE` if set when packaging. A `RELEASE` app setting overrides it at runtime.

Try it locally:

```sh
pnpm package:appservice
API_BASE_URL=https://ijanla-dev.azurewebsites.net PORT=8080 node dist-appservice/server.mjs
# http://localhost:8080/ is the site, http://localhost:8080/app/ is the app
```

## 3. One-time setup per slot

Do this for `dev`, `stage` and production (for production, leave out `--slot`).

| Setting | Value | How |
| --- | --- | --- |
| Runtime | Node 22 LTS (recommended). Node 20 LTS works too. | `az webapp config set -g ReminderServicerRG -n meminiNode --slot dev --linux-fx-version "NODE\|22-lts"` |
| Startup command | `node server.mjs` | `az webapp config set -g ReminderServicerRG -n meminiNode --slot dev --startup-file "node server.mjs"` |
| HTTPS only | on | `az webapp update -g ReminderServicerRG -n meminiNode --slot dev --https-only true` |
| Health check path | `/healthz` | Portal → the slot → Monitoring → Health check |
| Always on | on, if the plan allows it | Portal → the slot → Configuration → General settings |

The runtime and startup command move with the content in a swap, so keep them the same on every
slot.

## 4. App settings

Set these on each slot and tick **Deployment slot setting** on every one of them (sticky), so a
swap never carries stage's settings into production. With the CLI, `--slot-settings` makes them
sticky.

| Setting | dev | stage | production |
| --- | --- | --- | --- |
| `API_BASE_URL` | `https://ijanla-dev.azurewebsites.net` | `https://ijanla.azurewebsites.net` | `https://ijanla.azurewebsites.net` |
| `ENVIRONMENT` | `development` | `staging` | `production` |
| `SITE_URL` | `https://memininode-dev.azurewebsites.net` | `https://memininode-stage.azurewebsites.net` | `https://motorpapers.com` |
| `APP_URL` | `https://memininode-dev.azurewebsites.net/app` | `https://memininode-stage.azurewebsites.net/app` | `https://motorpapers.com/app` |
| `FLAG_RENEWALS` | `false` | `false` | `false` |
| `FLAG_REMINDER_SETTINGS` | `false` | `false` | `false` |
| `FLAG_TX_LABELS` | `false` | `false` | `false` |
| `FLAG_WALLET_PAY` | `false` | `false` | `false` |
| `FLAG_VERIFY_PAYMENT` | `false` | `false` | `false` |

Optional, also sticky:

| Setting | Use |
| --- | --- |
| `SENTRY_DSN` | The web app's Sentry DSN. Error reporting is off without it. |
| `RELEASE` | Overrides the release baked into the zip. |
| `DOC_PARSER_URL` | Another document reader. Defaults to `https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument`. |

All flags stay off at launch. Turn one on (`true`) on a slot only once the API there has the
endpoint behind it (`docs/launch/backend-status.md`); the app picks it up when the slot restarts,
with no new build.

`ENVIRONMENT` is Sentry's environment tag. Anything but `production` also adds
`X-Robots-Tag: noindex, nofollow` to every response, so search engines skip dev and stage.

Shared, the same on every slot (not sticky):

| Setting | Value |
| --- | --- |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` (the zip is already built; don't let Oryx run `npm install`) |

Example for dev:

```sh
az webapp config appsettings set -g ReminderServicerRG -n meminiNode --slot dev --slot-settings \
  API_BASE_URL=https://ijanla-dev.azurewebsites.net ENVIRONMENT=development \
  SITE_URL=https://memininode-dev.azurewebsites.net APP_URL=https://memininode-dev.azurewebsites.net/app \
  FLAG_RENEWALS=false FLAG_REMINDER_SETTINGS=false FLAG_TX_LABELS=false FLAG_WALLET_PAY=false FLAG_VERIFY_PAYMENT=false
az webapp config appsettings set -g ReminderServicerRG -n meminiNode --slot dev --settings \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

Changing an app setting restarts the slot. Check the result at `/app/config.js` (section 6).

## 5. Build and deploy

From a clean checkout of the commit you're releasing:

```sh
pnpm install --frozen-lockfile
pnpm package:appservice
az webapp deploy --resource-group ReminderServicerRG --name meminiNode --slot <slot> \
  --src-path dist-appservice.zip --type zip
```

`<slot>` is `dev` or `stage`. Production only ever gets a build through a swap (section 7).

Or run the **Deploy to App Service** workflow (`.github/workflows/deploy-appservice.yml`) from
the Actions tab and pick `dev` or `stage`. It builds the zip (kept 30 days as a run artifact),
deploys it to that slot and waits for `/healthz`. It signs in with OpenID Connect, so no password
is stored. To turn it on:

1. An Entra app registration (or user-assigned managed identity) with the **Website
   Contributor** role on `meminiNode`.
2. Federated credentials on it for GitHub Actions, one per GitHub environment the workflow uses:
   subject `repo:<owner>/<repo>:environment:appservice-dev` and
   `repo:<owner>/<repo>:environment:appservice-stage`.
3. Repository secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`.

Until those secrets exist the workflow builds the zip and skips the deploy with a notice.

## 6. Smoke test

Run through this on each slot after a deploy, and on production after a swap. `<host>` is the
slot's address.

- [ ] `https://<host>/healthz` says `ok`
- [ ] `https://<host>/app/config.js` shows this slot's `apiBaseUrl` and `sentryEnvironment`, and
      the flags you expect (all `false` at launch)
- [ ] The site loads at `https://<host>/`; "Sign in" goes to `/app/sign-in`
- [ ] `/privacy` moves to `/privacy/`; `/nowhere` shows the site's "Page not found"
- [ ] Sign in with a test account: Home shows its cars. Open a car, then refresh the page: the
      car's panel opens again
- [ ] Sign out, open `https://<host>/app/cars`: it asks you to sign in, then comes back to My cars
- [ ] Old addresses: `/login` → `/app/sign-in`, `/vehicles` → `/app/cars`,
      `/?trxref=TEST` → `/app/payments/callback?reference=TEST`
- [ ] Google sign-in comes back into the app (today through `/complete-onboard`)
- [ ] dev only: a test top-up on Paystack's test card comes back to the payment receipt. Stage
      and production use the live API, so don't pay there unless you mean to (a real ₦100 top-up
      is the launch check in `docs/launch/runbook.md` §4)
- [ ] The browser console shows no errors and no Content-Security-Policy reports
- [ ] Response headers (`curl -sI https://<host>/app/`) include `Content-Security-Policy` and
      `Strict-Transport-Security`; dev and stage also have `X-Robots-Tag: noindex, nofollow`,
      production doesn't

## 7. Swap into production, and rollback

When stage passes the smoke test:

```sh
az webapp deployment slot swap -g ReminderServicerRG -n meminiNode --slot stage --target-slot production
```

Then smoke-test production (section 6). The sticky settings stay with their slot, so production
keeps `ENVIRONMENT=production` and its own API.

**Rollback:** swap again with the same command. Production gets the previous build back (it went
to stage in the first swap). Then fix forward on dev.

## 8. Pointing the backend at the new addresses

Once production serves the new app, ask the backend to point at it:

| What | New address |
| --- | --- |
| Paystack callback URL | `https://motorpapers.com/app/payments/callback` |
| Google sign-in, the API's onward redirect | `https://motorpapers.com/app/auth/callback` |
| CORS on `ijanla`, `ijanla-dev` and the document reader | `https://motorpapers.com`, `https://www.motorpapers.com`, and each slot's `https://memininode-*.azurewebsites.net` that calls it (runbook §7) |
| Links in emails (`APP` in `docs/backend-handoff.md`) | `https://motorpapers.com/app` |

Until then the old addresses keep working: the server sends the old app's routes, and Paystack
and Google returns that land on them, into the new app (section 9).

## 9. What the server does

| Request | Answer |
| --- | --- |
| `GET /healthz` | `200 ok` |
| `/app` | `301` to `/app/` (query kept) |
| `/app/config.js` | `window.__MOTOPAPERS_CONFIG__ = {…};` from the app settings, `Cache-Control: no-store` |
| `/app/*` | The file if it exists; otherwise, for addresses without a file extension, the app's `index.html` (the app's router takes over). A missing file such as `/app/assets/old.js` is a `404`. |
| Old app routes | `301`, query kept: `/home` → `/app/`, `/vehicles` → `/app/cars`, `/transactions` → `/app/payments`, `/settings` → `/app/settings`, `/login` → `/app/sign-in`, `/signup` → `/app/sign-up`, `/forgot-password` → `/app/forgot-password`, `/reset-password` → `/app/reset-password`, `/complete-onboard` → `/app/complete-onboard` |
| Paystack returns | Any old route above, or `/`, with `trxref` or `reference` in the query: `302` to `/app/payments/callback?reference=<trxref or reference>` |
| Everything else | The site: the exact file, else the folder's `index.html`. `/privacy` → `301 /privacy/` (Astro's addresses end in a slash). Unknown addresses get the site's `404.html` with a `404`. |
| Anything but GET and HEAD | `405` |

Headers on every response: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`.
The site keeps the Content-Security-Policy from `apps/site/public/staticwebapp.config.json` (a
test keeps the two in step). The app's policy allows scripts only from itself and network calls
only to itself, the configured API, the document reader and Sentry. `upgrade-insecure-requests`
is sent only over HTTPS, so the package also runs on `http://localhost`.

Caching: hashed files (`/_astro/*`, `/app/assets/*`) a year, `immutable`; HTML revalidates every
time (`no-cache`, with an `ETag`); `config.js` is never stored; other files an hour. Text is sent
brotli- or gzip-compressed when the browser accepts it (compressed once per file, then kept in
memory). Paths that try to leave the package, hidden files and `staticwebapp.config.json` are
never served. On `SIGTERM` (restart, swap, scale-in) it stops taking requests, finishes the ones
in flight and exits.

## 10. Troubleshooting

| Symptom | Look at |
| --- | --- |
| The slot doesn't start | Log stream (`az webapp log tail -g ReminderServicerRG -n meminiNode --slot <slot>`). The first line should be `MotoPapers on port 8080 (environment: …)`. Check the startup command is `node server.mjs`. |
| The app says it can't reach the server | `/app/config.js`: is `apiBaseUrl` right? The log warns at start-up when `API_BASE_URL` isn't set. Then CORS on the API (section 8). |
| A new flag value doesn't show | Was it set on the right slot? The slot restarts on a settings change; reload `/app/config.js`. |
| Console reports a Content-Security-Policy violation | Something new is being loaded from another origin. Add it to `appCsp()` in `apps/server/server.mjs` (app) or to `staticwebapp.config.json` and `SITE_CSP` (site). |
| Oryx runs a build or `npm install` on deploy | `SCM_DO_BUILD_DURING_DEPLOYMENT` should be `false`. |
