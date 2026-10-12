# End-to-end, accessibility and performance checks

Phase 6's launch checks. CI runs all of them on every pull request (`.github/workflows/ci.yml`).

```sh
pnpm --filter e2e exec playwright install chromium webkit   # once
pnpm e2e                                                    # Playwright, both browsers
pnpm --filter e2e e2e --project=chromium tests/journey.spec.ts   # one file, one browser
pnpm --filter e2e exec playwright show-report               # the last run's report

pnpm --filter web build && pnpm --filter e2e budget         # the app's first-load budget
pnpm --filter site build && pnpm --filter e2e lighthouse    # Lighthouse on the site (needs Chrome)
```

## What runs

Playwright builds the app with the mock API and every flag on (`apps/web/dist-e2e`, served on
5176) and the site (served on 4326), then runs each spec in desktop Chrome and in WebKit at iPhone
size:

| Spec | What it checks |
| --- | --- |
| `journey` | A new driver signs up and verifies, tops up through Paystack (the mock checkout sends them straight back), lands on the payment return page, adds a car from a licence photo, pays from the wallet, sees it on Home, renews a paper and signs out |
| `keyboard` | Chrome only. Add a car with the keyboard alone, with visible focus; the car panel and Top up keep focus inside, close on Escape and give focus back |
| `accessibility` | axe (WCAG 2.2 A and AA) on every page and state of the app: signed out, signed in, error states, the sheet, modals, the payment return page, the renew page |
| `site` | axe on every page of the site, the FAQ, Get started into the app, and every page under the production Content-Security-Policy |
| `sentry` | An error reaches Sentry with its release, environment, page and driver id (never the email); an ended session (401) sends the driver to sign in without a report |

Every test also fails if the page throws an uncaught error or reports one to Sentry
(`tests/fixtures.ts`). The e2e builds report to fake DSNs that the fixture intercepts. In WebKit
the app's reports go through the mock API's service worker, which Playwright can't see, so only
Chromium checks what the app sends.

## Accessibility: what's allowed to fail

Serious and critical axe findings fail the test, with two exceptions, both in `tests/a11y.ts`:

- **Coral colour pairs** (`PENDING_CONTRAST`): white on coral and coral on light backgrounds fail
  AA contrast, but the brand colours are the owner's decision. The list and the ratios are in
  `docs/launch/runbook.md`. Any other contrast failure fails the test.
- **Artwork hidden from screen readers**: the phone mock-ups and the big faded plates. WCAG
  exempts decoration and text that's part of a picture.

Each run writes every page's findings to `test-results/axe/`.

## Budgets

`perf/budgets.json`. The app's budget counts what loads before the first page: the entry script,
everything it imports statically, and the stylesheet, gzipped. pdf.js, the mock API and Sentry
must stay out of it. Lighthouse runs on the site with the thresholds in `perf/lighthouserc.json`;
its reports land in `lighthouse-report/`.

Raise a budget only on purpose, in its own commit, saying what grew and why.
