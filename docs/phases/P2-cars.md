# Phase 2 · Cars

Branch: `phase-2/cars` · Port: 5172 · Depends on: P0 · Runs in parallel with: P1, P5

## Goal
Drivers see every paper's days left at a glance and can add a car from a photo of its licence.

## You own
`apps/web/src/features/home/**`, `apps/web/src/features/cars/**` (pages, components, composables,
`routes.ts`, tests). Read the session through the P0 store interface only; P1 is building it in
parallel, so use mocks (`VITE_USE_MOCKS=true`) while you work.

## Build (match the design's Home, My cars, car panel and Add a car screens)
- Data: `GET /vehicles` via Vue Query (key `['vehicles']`), `GET /wallets/balance`, latest 4
  `GET /transactions`. Status from `packages/api/status.ts`.
- **Home `/`**: greeting with "N cars · X of Y papers valid", the alert card (expired → coral,
  due soon → coral "Coming up", all valid → mint), the night wallet card (Top up button emits an event /
  links to `/payments?topup=1`; P3 builds the modal), "Coming up" tiles (next 4 by days left), "Your cars"
  mini cards with bars, "Recent activity" list.
- **My cars `/cars`**: search (plate, make, model), filter chips (All, Needs attention, Papers to add,
  All good) with counts, car cards with the three paper minis and the right action
  (Renew → emits to P4's flow; for now link to `/cars/:id`), empty state.
- **Car panel `/cars/:id`**: opens as a Sheet over My cars (deep-linkable). Papers with days left,
  Update a paper (form posting a new record to `/vehicle/:id/insurance|roadworthiness|vehicle-licenses`),
  Add a missing paper, specs (read-only, "Contact us to change"), colour edit via `PATCH /vehicles/:id`,
  delete with inline confirm via `DELETE /vehicles/:id` (not documented: handle failure gracefully).
- **Add a car `/cars/new`**, steps 1–3 (step 4 "Review and pay" is a placeholder P3 replaces; export a
  clear `onReadyToPay(draft)` seam):
  1. Upload: drag and drop, file picker, 4 MB limit, PDF → image (pdf.js, lazy-loaded), "Use a sample
     licence" only when mocks are on, "Enter details by hand".
  2. Check details: plate, licence expiry, licence PIN, make, model, colour, engine number, chassis
     number, engine capacity; "Read from licence" tags; duplicate-plate warning with "View it".
  3. Insurance (cover type segmented control, insurer picker from `GET /insurance-companies`, vehicle
     value for comprehensive, expiry) and roadworthiness (expiry or "I don't have one yet").
  On save: `POST /vehicles` (`is_paid_tier: true`), then the paper records. Handle partial failure
  (car created, paper failed) with a retry, not a duplicate car.
- Invalidate `['vehicles']` after any write.

## Tests
Status maths edge cases (today, yesterday, 30/31 days), filter/search logic, doc-reader mapping,
duplicate-plate normalisation, the add-car step machine.

## Done when
With mocks and against `ijanla-dev`, a car added from a licence photo appears with the right days left
on Home and My cars, and the panel updates and deletes correctly. Lint, typecheck, test, build pass.
