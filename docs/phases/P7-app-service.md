# Phase 7 · Deploy to the meminiNode App Service

Branch: `phase-7/app-service` · Ports: web 5177, server 8080 · Depends on: everything (all merged)

## Goal
One package that runs on the existing **meminiNode** Azure App Service (Linux, Node) and serves:
- the marketing site at `/` (motorpapers.com)
- the web app at `/app` (motorpapers.com/app)

The same package must work in all three slots, because releases go dev → stage → swap into production.
So nothing environment-specific may be baked into the build: the API address, Sentry and feature flags
come from each slot's App Service settings at runtime.

| Slot | Address | API |
| --- | --- | --- |
| dev | memininode-dev.azurewebsites.net | https://ijanla-dev.azurewebsites.net |
| stage | memininode-stage.azurewebsites.net | https://ijanla.azurewebsites.net |
| production | motorpapers.com, www.motorpapers.com, memininode.azurewebsites.net | https://ijanla.azurewebsites.net |

**Do not touch Azure** (no `az` commands that change anything). The manager session deploys.

## Build

### 1. Web app under `/app`
- `vite.config.ts`: `base` from `process.env.WEB_BASE` (default `/`). The App Service build uses `/app/`.
- Check every place that assumes the app is at the root and make it base-aware: hard-coded `href="/…"`,
  `window.location` uses, the OAuth callback and Paystack return paths, `safeNext()` and `?next=`, the pdf.js
  worker URL, favicon, and any `fetch('/…')` of app files. Router history already uses `BASE_URL`.
- Tests covering a non-root base (e.g. `next` handling and any URL builders).
- Local dev and the existing e2e suite keep working at `/`.

### 2. Runtime settings
- `apps/web/public/config.js`: `window.__MOTOPAPERS_CONFIG__ = {};` (dev default).
- `index.html` loads `config.js` (relative to the base) with a classic `<script>` **before** the app module.
- `env.ts`: read `window.__MOTOPAPERS_CONFIG__` first, falling back to `import.meta.env`. Keys:
  `apiBaseUrl, docReaderUrl, appUrl, siteUrl, sentryDsn, sentryEnvironment, release` and `flags`
  (`renewals, reminderSettings, txLabels, walletPay, verifyPayment`). Validate with Zod; ignore unknown keys.
  Mocks can never be switched on at runtime in a production build.

### 3. `apps/server` — zero-dependency Node server (ESM, runs on Node 20 and 22)
Only `node:` built-ins, so the deploy needs no `npm install`.
- `PORT` from the environment (default 8080). `GET /healthz` → `200 ok`.
- `GET /app/config.js` → `window.__MOTOPAPERS_CONFIG__ = {…};` built from env vars:
  `API_BASE_URL, DOC_PARSER_URL, SITE_URL, APP_URL, SENTRY_DSN, ENVIRONMENT, RELEASE,
  FLAG_RENEWALS, FLAG_REMINDER_SETTINGS, FLAG_TX_LABELS, FLAG_WALLET_PAY, FLAG_VERIFY_PAYMENT`.
  Safely serialised (no `</script>` injection), `Cache-Control: no-store`.
- `/app` → 301 `/app/`. `/app/*`: serve the file if it exists, otherwise the SPA fallback `/app/index.html`
  (GET/HEAD for paths without a file extension).
- Everything else is the site: exact file, else `<path>/index.html`; `/privacy` → 301 `/privacy/` (Astro uses
  trailing slashes); unknown → the site's `404.html` with status 404.
- **Old app links** (301, keep the query string): `/home` → `/app/`, `/vehicles` → `/app/cars`,
  `/transactions` → `/app/payments`, `/settings` → `/app/settings`, `/login` → `/app/sign-in`,
  `/signup` → `/app/sign-up`, `/forgot-password` → `/app/forgot-password`,
  `/complete-onboard` → `/app/complete-onboard` (Google sign-in returns here today).
  **Paystack returns**: any of those old routes (and `/`) arriving with `trxref` or `reference` in the query →
  302 `/app/payments/callback?reference=<trxref or reference>`.
- Headers: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options: DENY`. The site keeps the CSP from `apps/site/public/staticwebapp.config.json`.
  The app gets a CSP whose `connect-src` includes the configured API, the document reader and Sentry.
- Caching: hashed assets (`/_astro/*`, `/app/assets/*`) `public, max-age=31536000, immutable`; HTML and
  `config.js` not cached; other files a short max-age. ETag + 304. HEAD supported.
- Compression: brotli or gzip for text types when the client accepts it.
- Only GET and HEAD (405 otherwise). Block path traversal. Shut down cleanly on SIGTERM.
- Vitest tests for routing, redirects (including the Paystack ones), config.js output and escaping,
  traversal, caching headers, 404s and the SPA fallback.

### 4. Packaging
- `pnpm package:appservice`:
  - builds the site with `PUBLIC_APP_URL=/app` and `PUBLIC_SITE_URL` (default `https://motorpapers.com`)
  - builds the web app with `WEB_BASE=/app/`, `VITE_USE_MOCKS=false` and no API address baked in
  - assembles `dist-appservice/`: `server.mjs`, `package.json` (`"type": "module"`, `"start": "node server.mjs"`,
    no dependencies, `engines.node >=20`), `site/`, `web/`, and zips it to `dist-appservice.zip`
  - git-ignore both outputs
- The site must still build for its old root setup when `PUBLIC_APP_URL` is a full URL.

### 5. `docs/deploy/app-service.md`
- The slot table above.
- App settings per slot, all marked **deployment slot setting** (sticky): `API_BASE_URL`, `ENVIRONMENT`,
  `SITE_URL`, `APP_URL`, and the flags (all off at launch). Shared: `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- Startup command `node server.mjs`. Runtime: Node 20 LTS works; Node 22 recommended.
- Deploy: `az webapp deploy --resource-group ReminderServicerRG --name meminiNode --slot <slot> --src-path dist-appservice.zip --type zip`
- Smoke test checklist per slot; swap (`az webapp deployment slot swap … --slot stage --target-slot production`)
  and rollback (swap again).
- What the backend should point at once live: Paystack callback `https://motorpapers.com/app/payments/callback`,
  Google redirect `https://motorpapers.com/app/auth/callback`. The old routes keep working until then.

### 6. Optional: `.github/workflows/deploy-appservice.yml`
`workflow_dispatch` with a `slot` input (dev or stage): build the package and deploy with
`azure/webapps-deploy`. Authenticate with OIDC (`azure/login` using `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` secrets) and skip cleanly when they're missing. No swap job: swapping stays manual.

## Done when
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm package:appservice` pass.
- `API_BASE_URL=https://ijanla-dev.azurewebsites.net PORT=8080 node dist-appservice/server.mjs` serves the site
  at `/`, the app at `/app/` (sign-in page loads, config applied, deep links refresh fine), and the old-route
  and Paystack redirects. Checked in headless Chrome, no console errors.
- The existing e2e suite still passes.
