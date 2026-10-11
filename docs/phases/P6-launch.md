# Phase 6 · QA and launch readiness

Branch: `phase-6/launch` · Port: 5176 · Depends on: all other phases (merged)

## Goal
Make the app and site safe to ship: tested, accessible, fast, and with a written runbook for the beta
and the domain switch. The real launch steps (DNS, live keys, inviting users) are done by the owner;
you prepare everything they need.

## You own
`e2e/**`, `docs/launch/**`, and small fixes anywhere they're needed for the checks below (keep each
fix in its own commit and list them in the PR).

## Build
- **Playwright** suite against the web app with mocks: sign up → verify → add a car (sample licence)
  → pay by wallet → see it on Home; top up (Paystack redirect stubbed) → callback success; renew a paper;
  sign out. Run in CI on PRs (headless Chromium, plus WebKit mobile viewport).
- **Accessibility**: axe checks in Playwright on every page; fix everything serious or critical;
  keyboard-only pass of the add-car flow and sheets/modals.
- **Performance**: budget checks (initial JS for the app, Lighthouse for the site) in CI; lazy-load
  pdf.js and heavy routes.
- **Error monitoring**: Sentry wired in web and site with release tags, behind `VITE_SENTRY_DSN`.
- **docs/launch/runbook.md**: beta steps, the launch checklist from the plan as checkboxes,
  environment variables per environment, Paystack callback/webhook URLs, OAuth redirect URLs, CORS
  list, DNS steps for Azure Static Web Apps, rollback, and who to call.
- **docs/launch/backend-status.md**: each backend gap from `docs/phases/api-gaps.md` with its flag and
  what turns on when the backend ships it.

## Done when
E2E and accessibility checks pass in CI, the runbook is complete, and lint/typecheck/test/build pass.
