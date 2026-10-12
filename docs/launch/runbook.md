# Launch runbook

How to take MotoPapers from staging to a beta at `app.<domain>`, then to launch on `<domain>`, and
how to undo each step. The owner runs these steps; everything in the repo is ready for them.
Replace `<domain>` with the real domain throughout (the plan's open question: the old app is on
`memininode.azurewebsites.net` today).

Related: `docs/setup.md` (Azure and GitHub setup, deploys), `docs/launch/backend-status.md` (what
the API still has to ship, and the flag for each), `docs/backend-handoff.md` (emails, renewals),
`e2e/README.md` (the checks CI runs).

## Contents

1. [Environments](#1-environments)
2. [Environment variables](#2-environment-variables)
3. [Beta (M3)](#3-beta-m3)
4. [Launch checklist (M4)](#4-launch-checklist-m4)
5. [Paystack](#5-paystack)
6. [Google sign-in](#6-google-sign-in)
7. [CORS](#7-cors)
8. [DNS for Azure Static Web Apps](#8-dns-for-azure-static-web-apps)
9. [The domain switch (launch day)](#9-the-domain-switch-launch-day)
10. [Rollback](#10-rollback)
11. [Monitoring](#11-monitoring)
12. [Accessibility: contrast failures waiting on the owner](#12-accessibility-contrast-failures-waiting-on-the-owner)
13. [Who to call](#13-who-to-call)

## 1. Environments

| | Preview | Staging | Production |
| --- | --- | --- | --- |
| Deploys | every pull request | every merge to `main` | after approval on the `production` environment |
| Web app | Azure URL per PR | the `staging` environment's Azure URL (or `app-staging.<domain>`, see §8) | `https://app.<domain>` |
| Site | Azure URL per PR | the `staging` environment's Azure URL (or `staging.<domain>`) | `https://<domain>` (`www` redirects to it) |
| API | `https://ijanla-dev.azurewebsites.net` | `https://ijanla-stage.azurewebsites.net` | `https://ijanla.azurewebsites.net` |
| Paystack | test keys | test keys | live keys |
| Search engines | `noindex` | `noindex` | indexed (legal pages stay `noindex` until their real text is in) |

## 2. Environment variables

Set these as **GitHub environment variables** (Settings → Environments → `<name>` → Variables),
not repository variables. None of them is secret: Paystack and Google keys live on the API. The
workflows set the ones marked "set by the workflow"; anything unset falls back to the defaults in
`.github/workflows/deploy-*.yml` (the right API, mocks off, every flag off).

### Web app

| Variable | Preview | Staging | Production |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | default (`ijanla-dev`) | default (`ijanla-stage`) | default (`ijanla`) |
| `VITE_DOC_PARSER_URL` | unset (the production reader) | unset | unset |
| `VITE_APP_URL` | unset | the staging app URL | `https://app.<domain>` |
| `VITE_SITE_URL` | unset | the staging site URL | `https://<domain>` |
| `VITE_USE_MOCKS` | `false` | `false` | always `false` (forced by the workflow) |
| `VITE_SENTRY_DSN` | the web project's DSN | same | same |
| `VITE_SENTRY_ENVIRONMENT` | `preview` (set by the workflow) | `staging` (set) | `production` (set) |
| `VITE_RELEASE` | the commit (set by the workflow) | same | same |
| `VITE_FLAG_RENEWALS` | `false` until the API ships it | `false` until it's on staging | `false` until it's live |
| `VITE_FLAG_REMINDER_SETTINGS` | as above | as above | as above |
| `VITE_FLAG_TX_LABELS` | as above | as above | as above |
| `VITE_FLAG_WALLET_PAY` | as above | as above | as above |
| `VITE_FLAG_VERIFY_PAYMENT` | as above | as above | as above |

Flags are baked in at build time: changing one needs a redeploy (re-run the environment's latest
`Deploy web app` run, or merge anything). `backend-status.md` says what each flag turns on.

### Site

| Variable | Preview | Staging | Production |
| --- | --- | --- | --- |
| `PUBLIC_APP_URL` | unset | the staging app URL | `https://app.<domain>` |
| `PUBLIC_SITE_URL` | unset | the staging site URL | `https://<domain>` |
| `PUBLIC_ANALYTICS_DOMAIN` | unset | unset | `<domain>` (Plausible) |
| `PUBLIC_NOINDEX` | `true` (set by the workflow) | `true` (set) | unset |
| `PUBLIC_SENTRY_DSN` | the site project's DSN | same | same |
| `PUBLIC_SENTRY_ENVIRONMENT` | `preview` (set by the workflow) | `staging` (set) | `production` (set) |
| `PUBLIC_RELEASE` | the commit (set by the workflow) | same | same |

```sh
gh variable set VITE_APP_URL --env production --body "https://app.<domain>"
gh variable set VITE_SITE_URL --env production --body "https://<domain>"
gh variable set PUBLIC_APP_URL --env production --body "https://app.<domain>"
gh variable set PUBLIC_SITE_URL --env production --body "https://<domain>"
gh variable set PUBLIC_ANALYTICS_DOMAIN --env production --body "<domain>"
for env in preview staging production; do
  gh variable set VITE_SENTRY_DSN --env $env --body "<web DSN>"
  gh variable set PUBLIC_SENTRY_DSN --env $env --body "<site DSN>"
done
```

### Repository secrets

Only the two deploy tokens (`docs/setup.md`, step 2). The repo is public: no other keys go in it.

## 3. Beta (M3)

The new app runs at `app.<domain>` while the old app stays the main one. A week of feedback, then
launch.

**Before:**

- [ ] All phase pull requests merged; CI green on `main` (lint, typecheck, test, build, E2E and
  accessibility, performance budgets)
- [ ] `main` protected with all three checks required and one review (`docs/setup.md`, step 5)
- [ ] Staging deployed and approved; the backend's P0 items on `ijanla-stage`
  (`backend-status.md`), or their flags left off
- [ ] Staging smoke test, on a phone and a laptop, against `ijanla-stage`:
  - [ ] Sign up with a real inbox, get the code, verify; sign out and sign in again
  - [ ] Forgot password: get the code, reset, sign in with the new password
  - [ ] Google: sign up and sign in
  - [ ] Add a car from a photo of a real licence, and from a PDF
  - [ ] Pay the tracking fee by card on Paystack (test card) and land on the payment receipt
  - [ ] Top up ₦1,000 by card; see it on Home and Payments
  - [ ] A failed card (Paystack's test failure card): the page says it didn't go through
  - [ ] Renew a paper: with `VITE_FLAG_RENEWALS` off, the page gives the number to call or
    WhatsApp; with it on, pay and watch the tracker
  - [ ] Settings: change name, phone and address; change password
  - [ ] Leave the app open 31 minutes, click anything: back to sign in, then back where you were
  - [ ] The old addresses redirect: `/home`, `/vehicles`, `/transactions`, `/login`, `/signup`
  - [ ] Sentry receives a test error from staging (see §11)
- [ ] §5, §6 and §7 done for production
- [ ] `app.<domain>` added to the web app's Static Web App (§8)

**Go:**

1. Approve the waiting `production` deployment of `Deploy web app` (Actions tab). The site can
   wait for launch day.
2. On `https://app.<domain>`, make one real ₦100 top-up with live Paystack, and check: the receipt
   page, the receipt email, the transaction on Payments, the webhook in the Paystack dashboard.
3. Invite existing users by email. There's no invite template in `emails/` yet; a short plain email
   works: "We've rebuilt MotoPapers. Sign in at app.<domain> with your usual email and password,
   and tell us what you think: reply to this email or call +234 802 959 5069."
4. Watch Sentry, the Paystack dashboard and the support line for a week. Fix, merge, approve.

## 4. Launch checklist (M4)

From `docs/build-plan.html`, with what the repo already covers marked.

- [ ] Domain and SSL for the site and the app, with `www` redirecting to the bare domain (§8)
- [ ] CORS on the API and doc parser allows the new domains only (§7)
- [ ] Google OAuth redirect URLs registered for production (§6)
- [ ] Paystack live keys, callback URL and webhook URL set and tested with a real ₦100 payment (§5)
- [ ] Email sending domain verified (SPF, DKIM, DMARC) and a reply inbox monitored
- [ ] Reminder job scheduled, with a dry run that logs who would get an email
  (`docs/backend-handoff.md`)
- [ ] Accessibility: keyboard, screen reader and contrast pass (WCAG 2.2 AA). Keyboard and axe
  checks run in CI on every page; **contrast fails on the coral pairs in §12 until the owner
  decides**; a manual screen reader pass (VoiceOver on iPhone, TalkBack on Android) is still to do
- [x] Speed: landing page main content under 2.5 seconds on a mid-range Android phone over 4G.
  Lighthouse (mobile, throttled) in CI: performance 100, LCP about 1.5 s, no JavaScript. Re-check
  on production with a real phone
- [x] End-to-end tests green: sign up, add a car, top up, renew (`pnpm e2e`, in CI)
- [x] Old-route redirects and a friendly 404 page (`staticwebapp.config.json` and the app's router;
  both 404 pages are checked by axe)
- [ ] Search basics for the site: titles, descriptions, sitemap, robots, social preview image are
  in. **The privacy and terms pages hold placeholder text**: replace it, then set
  `LEGAL_IS_PLACEHOLDER = false` in `apps/site/src/config.ts`
- [ ] Monitoring: Sentry releases (wired; needs the DSNs, §11), uptime checks (§11), and analytics
  (Plausible needs `PUBLIC_ANALYTICS_DOMAIN`; it sets no cookies, so no cookie notice is needed.
  Sign-up, car added and payment success events aren't tracked in the app yet)
- [ ] Old app kept running 30 days after launch (§9)

## 5. Paystack

The app never talks to Paystack directly: the API's `POST /transactions/initialize` returns
Paystack's `auth_url`, the driver pays, Paystack sends them back to the app, and the app waits for
the API (the webhook) to confirm before it shows "Payment received".

| Setting (Paystack dashboard → Settings → API Keys & Webhooks) | Test mode (dev, staging) | Live mode (production) |
| --- | --- | --- |
| Callback URL | the staging app's `/payments/callback` | `https://app.<domain>/payments/callback` |
| Webhook URL | the staging API's webhook address | the production API's webhook address |

- The callback must be **`/payments/callback`** exactly; the page reads `?reference=` (and
  Paystack's `trxref`).
- The webhook address is the API's (not in the API docs; ask the backend). It must check
  Paystack's signature and be safe to receive twice: it's what marks a payment `success` or
  `failed`, and the payment stream and emails depend on it.
- Dev and staging share Paystack's test mode, which has one callback URL. Better: the API passes
  `callback_url` to Paystack on each initialize, from its own setting (`APP_URL` +
  `/payments/callback`), so each environment returns to its own app. Until then, a payment started
  on a preview finishes on the staging app.
- Live test: one real ₦100 top-up after the switch to live keys (§3, Go step 2).

## 6. Google sign-in

Google sends the driver back to the **API** (`GET /users/oauth-url` returns a Google address
whose `redirect_uri` is the API's own, `/users/auth/google`), and the API then sends them on to
the app with a `code`.

- [ ] Google Cloud console → Credentials → the OAuth client → Authorized redirect URIs: each API
  environment's address, e.g. `https://ijanla.azurewebsites.net/users/auth/google` (the backend
  knows the exact path).
- [ ] The API's onward redirect, per environment: `https://app.<domain>/auth/callback` (production),
  the staging app's `/auth/callback`. Today it goes to the old app's `/complete-onboard`; the new
  app answers that address too, so nothing breaks before the change.
- [ ] Authorized JavaScript origins (if the client lists any): `https://app.<domain>` and the
  staging app.
- [ ] OAuth consent screen: app name MotoPapers, the new domain under authorised domains, support
  email, privacy policy link (`https://<domain>/privacy/`, once its real text is in).

## 7. CORS

The browser calls the API and the document reader directly, so both must allow the app's origin.
Exact origins, no wildcards, no trailing slash.

| Service | Allow |
| --- | --- |
| `ijanla.azurewebsites.net` | `https://app.<domain>` |
| `ijanla-stage.azurewebsites.net` | the staging app's URL (and `https://app-staging.<domain>` if used) |
| `ijanla-dev.azurewebsites.net` | each preview URL (`https://<name>-<n>.<region>.azurestaticapps.net`; allow the pattern if the API supports it), `http://localhost:5170` to `http://localhost:5176` for local work |
| `motorpapers-doc-parser-api.azurewebsites.net` | all of the above that read licences (production, staging, previews, localhost) |

The site makes no API calls. Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS` (`PATCH` changes a car's colour); headers:
`Authorization, Content-Type`. Once the old app is gone (30 days after launch), remove
`memininode.azurewebsites.net`.

## 8. DNS for Azure Static Web Apps

Two Static Web Apps (`docs/setup.md`, step 1): `motopapers-web` (the app) and `motopapers-site`.
Custom domains attach to each one's production environment. Azure issues and renews the SSL
certificates itself. The portal shows the exact records to add; these are what to expect.

A day before: lower the TTL on the records you'll change to 300 seconds.

**The app, `app.<domain>`** (beta, §3):

1. Portal → `motopapers-web` → Custom domains → Add → Custom domain on other DNS → `app.<domain>`.
2. At the DNS provider: `CNAME  app  →  <motopapers-web default hostname>.azurestaticapps.net`.
3. Validate in the portal; wait for the certificate (minutes to an hour).

**The site, `<domain>` and `www.<domain>`** (launch day, §9):

1. Portal → `motopapers-site` → Custom domains → Add `<domain>`. Apex domains validate with a TXT
   record: add the `TXT` record the portal shows (host `_dnsauth` or `@`, as it says).
2. Point the apex at the site: an `ALIAS`/`ANAME` record (or a flattened `CNAME`) to
   `<motopapers-site default hostname>.azurestaticapps.net`. If the DNS provider has none of
   these, move the zone to Azure DNS and use an alias record to the Static Web App.
3. Add `www.<domain>`: `CNAME  www  →  <motopapers-site default hostname>.azurestaticapps.net`, and
   add it in the portal.
4. Custom domains → `<domain>` → Set as default. Static Web Apps then redirects `www` to it.

**Staging on our own domain (optional):** custom domains only attach to production. For
`app-staging.<domain>` and `staging.<domain>`, create two more Static Web Apps and point the
workflows' staging jobs at their tokens (`docs/setup.md`, step 6). Otherwise staging keeps its
Azure URLs.

**Email:** whoever sends the emails needs SPF, DKIM and DMARC on the sending domain; don't remove
existing MX or TXT records when changing the apex.

## 9. The domain switch (launch day)

1. Morning, with the backend and owner on hand. Check Sentry is quiet and the beta is healthy.
2. Approve the production deployment of `Deploy marketing site` (if it isn't already live).
3. Add the site's domains (§8) and wait for the certificates.
4. Send the old app's address to the new app: on the old App Service, redirect every path to
   `https://app.<domain>` with the same path and query (301). The new app turns the old paths into
   new ones (`/home` → `/`, `/vehicles` → `/cars`, `/transactions` → `/payments`, `/login` →
   `/sign-in`, `/signup` → `/sign-up`). **Keep the old App Service running**: switch the redirect
   off to roll back.
5. Check: `https://<domain>`, `https://www.<domain>` (redirects), `https://app.<domain>`, an old
   address, a sign-in, a real ₦100 top-up.
6. Tell users (email, social) and update links that pointed to the old app.
7. Thirty days on, with nothing pending: stop the old App Service and remove its CORS entry.

## 10. Rollback

| What went wrong | Do this | Takes |
| --- | --- | --- |
| A bad app or site release | Actions → `Deploy web app` (or `Deploy marketing site`) → the last good run on `main` → Re-run all jobs → approve production. It rebuilds that commit. Or revert the commit on `main` | minutes |
| A feature behind a flag misbehaves | Set the flag to `false` for that environment, then re-run the latest deploy run | minutes |
| Payments failing | Check the Paystack dashboard (webhook deliveries) and Sentry. If the API is at fault, roll back the API. Tell drivers on the support line; for slow ones the app already shows "Still confirming" and says it'll email them | — |
| The new app is broken after the domain switch | Switch the old App Service's redirect off (§9 step 4) so the old address serves the old app again; tell users to use it | minutes |
| The site is broken after the switch | Re-run its last good deploy; if the domain itself is wrong, point the apex back where it was (the low TTL helps) | minutes to an hour |
| A secret leaked into the repo | Revoke it at the source first, then remove it from history | — |

The old App Service stays up for 30 days after launch for exactly this.

## 11. Monitoring

- **Sentry** (wired in both front ends; on when a DSN is set):
  1. Create a Sentry organisation (EU data region if you prefer) and two projects: `motopapers-web`
     (Vue) and `motopapers-site` (browser JavaScript).
  2. Set `VITE_SENTRY_DSN` and `PUBLIC_SENTRY_DSN` per environment (§2) and redeploy.
  3. Every report has the release (`motopapers-web@<commit>`), the environment, the page, and
     the driver's id (never their email). Expected sign-outs (401) aren't reported.
  4. Alerts: new issue in `production` → email; more than 20 events in an hour → email.
  5. Test: in the staging app, open the browser console and run
     `setTimeout(() => { throw new Error('Sentry test') })`; it shows up within a minute.
  6. Optional: readable stack traces. The builds publish source maps next to the code, which Sentry
     can fetch. For private upload instead, add a `SENTRY_AUTH_TOKEN` secret and the Sentry Vite
     plugin.
  7. The site's CSP already allows `https://*.sentry.io`.
- **Uptime:** any uptime service (Azure Application Insights availability tests, UptimeRobot,
  Better Stack), checking every 5 minutes and alerting by email and SMS:
  `https://<domain>`, `https://app.<domain>`, `https://ijanla.azurewebsites.net` (a cheap `GET`
  the backend names), and the document reader.
- **Payments:** Paystack dashboard → Webhooks, for failed deliveries.
- **Analytics:** Plausible on the site (`PUBLIC_ANALYTICS_DOMAIN`).

## 12. Accessibility: contrast failures waiting on the owner

The brand colours stay as they are until the owner decides; these are the pairs that fail WCAG AA
contrast (4.5:1 for normal text, 3:1 for large). Everything else axe finds as serious or critical
is fixed, and any new contrast failure outside this list fails CI. The list lives in
`e2e/tests/a11y.ts` (`PENDING_CONTRAST`).

| Pair (text on background) | Ratio | Where |
| --- | --- | --- |
| white on coral `#ff5a3c` | 3.09:1 | every coral button (Sign in, Create account, Renew…, Top up, Add a car, Pay…), the site's "New" tag and Get started buttons |
| white on coral-d `#de3b22` | 4.41:1 | Home's expired alert card, the car panel header for a car with an expired paper |
| white on `#e56653` | 3.3:1 | the "Needs action" chip on Home's expired alert card |
| white on `#ff7157`, `#fff3f1` on `#ff7157` | 2.7:1, 2.49:1 | the three steps on the sign-up page's coral panel |
| coral-d `#de3b22` on white | 4.41:1 | text links (Forgot password?, Create an account, Sign in, Send a new code), the active tab on phones, "Renew licence" on Home's alert card |
| coral-d on the page background `#f4f3f9` | 4:1 | Home's "See all", "+ Add a car", "View all"; "Use the sample account"; "Contact us to change them" |
| coral-d on rose `#ffe2dc` | 3.6:1 | the active item in the sidebar |
| coral-d on coral-soft `#ffe6e0` | 3.71:1 | soft coral buttons ("Add missing papers"), the site's section tags |
| `#fff5f3` on coral | 2.89:1 | site: the closing "Get started" section's text |
| white on `#ff674c` | 2.87:1 | site: "I have an account" on the closing section |

What would fix them, for the owner to choose:

- **Buttons and coral backgrounds:** a slightly deeper coral, e.g. `#d9391f`, gives white text
  4.6:1 (and fixes coral-d on white at the same time if coral-d moves to it). Or keep the coral and
  use dark ink text on it (`#1e1b33` on coral is 5.4:1).
- **Coral text on tinted backgrounds:** the expired red `--rose-i` `#c02b15` passes on all of them
  (5.3:1 on the page background, 4.8:1 on rose, 4.9:1 on coral-soft).
- **The sign-up panel's steps and the site's closing section:** follow whichever coral is chosen,
  and drop the translucent white layers behind the text.

## 13. Who to call

Fill in names and numbers before the beta.

| For | Who | Contact |
| --- | --- | --- |
| Launch decisions, brand colours, copy | Owner | |
| The API: CORS, Google redirect, Paystack keys and webhook, reminder job, emails | Backend developer | |
| This repo: the app, the site, deploys | Frontend developer | |
| Domain and DNS | Whoever holds the registrar account | |
| Azure (Static Web Apps, App Service) | Azure subscription owner; Azure support from the portal | |
| Paystack | Paystack support (dashboard → Support), the account owner | |
| Sentry, uptime alerts | Whoever receives the alert emails | |
| Drivers with a problem | Support line: +234 802 959 5069 (call or WhatsApp) | |
