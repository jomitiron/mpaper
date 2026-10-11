# Phase 4 · Renewals and reminders

Branch: `phase-4/renewals` · Port: 5174 · Depends on: P3 (merged) · Unblocks: P6

## Goal
The Renew button works everywhere it appears, renewal progress is visible, and Settings is complete.

## You own
`apps/web/src/features/renewals/**`, `apps/web/src/features/settings/**`. Small, clearly marked edits
to wire the Renew buttons in `features/home` and `features/cars` are expected; keep them minimal.

## Build (match the design)
- **Renew flow** (sheet or page from any Renew button, with the car and paper preselected):
  confirm paper and car, price from `GET /pricing`, delivery address (prefilled from the user; save
  back with `PUT /users`), pay with wallet or card (reuse P3's payment helpers), then
  `POST /vehicles/:id/renewals` (mock, `VITE_FLAG_RENEWALS`). With the flag off, show the fallback:
  "Request renewal" that records the request and tells the driver the team will contact them.
- **Renewal status**: in the car panel, a tracker (Paid, Processing, Out for delivery, Delivered) from
  `GET /vehicles/:id/renewals`; Home's alert card switches to "Renewal in progress" when one exists.
- **Settings `/settings`**: profile view/edit (`PUT /users`: first name, last name, phone, address),
  verified email, change password (`POST /users/password` with old/new, errors inline), Google connect
  (link only, note for backend), sign out. Reminder settings card (email, SMS, WhatsApp, lead days,
  auto-renew) behind `VITE_FLAG_REMINDER_SETTINGS` using the mock.
- Reminder and renewal **emails** are already designed in `emails/` and are sent by the backend; don't
  rebuild them. Add a short `docs/backend-handoff.md` listing exactly which events should send which
  template, with the variables the app can supply.

## Tests
Renew flow state machine (wallet short, card path, flag off fallback), Settings form validation and
optimistic update rollback.

## Done when
With mocks, renewing a paper from Home, My cars and the panel creates a renewal and shows its status,
and Settings saves profile and password changes against `ijanla-dev`. Lint, typecheck, test, build pass.
