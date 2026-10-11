# Phase 3 · Payments

Branch: `phase-3/payments` · Port: 5173 · Depends on: P0, P1, P2 (merged) · Unblocks: P4

## Goal
Drivers can top up their wallet and pay the tracking fee, and see clearly what every payment was for.

## You own
`apps/web/src/features/payments/**`, and step 4 of Add a car (replace P2's placeholder through the
`onReadyToPay(draft)` seam; keep P2's files otherwise untouched).

## Build (match the design's Payments screen, top-up modal and Add a car step 4)
- **Payments `/payments`**: night wallet card with balance and stats, Top up button, filter chips
  (All, Top-ups, Renewals, Pending) mapped to `GET /transactions?status=&page=&per_page=`, grouped by
  month, status pills (Paid, Pending, Failed, Reversed), amounts with sign, infinite or paged loading,
  "Check status" on pending (`POST /transactions/:reference/verify` behind `VITE_FLAG_VERIFY_PAYMENT`,
  else re-fetch `GET /transactions/:id`), "Retry" on failed (opens top-up with the amount).
  Labels via `VITE_FLAG_TX_LABELS` (see api-gaps.md), sensible fallback without it.
- **Top-up modal**: amount input with ₦ formatting, quick amounts, minimum ₦100, then
  `POST /transactions/initialize` with `transaction_category: "wallet_transaction"` and redirect to
  `auth_url`. Open it from `/payments?topup=1` too (Home's wallet card links there).
- **Payment return `/payments/callback?reference=`**: "Confirming your payment…" state, then
  `waitForPayment(reference)` from `packages/api/sse.ts`; success → receipt view (amount, reference, new
  balance) and invalidate wallet/transactions/vehicles; failure → reason + Try again; timeout → "Still
  confirming. We'll email you" with a link to Payments.
- **Add a car step 4 · Review and pay**: car summary, papers, price from `GET /pricing` (mock), pay with
  Wallet (`POST /wallets/debit` behind `VITE_FLAG_WALLET_PAY`; disabled with a reason if the balance is
  short) or Card/bank transfer (`initialize` with `service_charge` → Paystack → callback returns to the
  success screen). Success screen from the design ("KTU 604 XR is all set", first reminder date).
- Remember where to return after Paystack (store the intent before redirecting).

## Tests
Amount parsing/formatting, filter → query mapping, month grouping, callback state machine
(success, failure, timeout) with the SSE helper mocked.

## Done when
Top-up and add-a-car payment work end to end against mocks and in Paystack test mode on `ijanla-dev`
(if keys are set up there), landing on the right receipt. Lint, typecheck, test, build pass.
