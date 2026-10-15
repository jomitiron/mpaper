# Backend status

What the web app needs from the API that isn't there yet, as of 12 Oct 2026. The app is built
against MSW mocks with the shapes in `docs/phases/api-gaps.md`; each gap that changes the UI sits
behind a `VITE_FLAG_*` flag, **off** in preview, staging and production until the endpoint ships.

## Turning a flag on

1. The backend ships the endpoint on `ijanla-stage`, matching the shape in `api-gaps.md` (or the
   app's Zod schema in `packages/api/src/schemas/gaps.ts` is updated to match what shipped).
2. Turn the flag on for staging and redeploy:
   `gh variable set VITE_FLAG_RENEWALS --env staging --body true`, then re-run the latest
   `Deploy web app` run on `main`.
3. Check it on staging with the smoke test in `runbook.md` §3, plus the checks below.
4. Once the endpoint is on `ijanla` (production), do the same for `production`. Previews follow
   `ijanla-dev`.
5. When every environment has it, delete the mock for it in `packages/api/src/mocks/handlers.ts`
   (the mocks stay for local work and the e2e suite until then).

## Gaps with a flag

| Gap | Flag | With the flag off (today) | With it on |
| --- | --- | --- | --- |
| **Renewals**: `POST /vehicles/:id/renewals`, `GET /renewals`, `GET /vehicles/:id/renewals` | `VITE_FLAG_RENEWALS` | Renew opens a page that shows the car, the paper and the price, and asks the driver to call or WhatsApp +234 802 959 5069. Nothing is recorded in the app. | Pay for a renewal from the wallet or by card (Paystack), with a delivery address; a tracker (Paid, Processing, Out for delivery, Delivered) on the renew page and the car panel; "Renewal in progress" on Home and My cars instead of a second Renew button. |
| **Pay from the wallet**: `POST /wallets/debit` | `VITE_FLAG_WALLET_PAY` | The tracking fee in Add a car is paid by card or bank transfer on Paystack only. Payments says "Top up any time by card or bank transfer." | A "Wallet" option in Add a car's Review and pay (off when the balance is short). Payments says renewals come out of the wallet first. |
| **Say what each payment was for**: `category`, `description`, `vehicle_id`, `document_type` on transactions | `VITE_FLAG_TX_LABELS` | Payments, the receipt and Home's recent activity call a credit "Wallet top-up" and a debit "Payment". | "Licence renewal · EKY 219 GD", "Tracking and reminders"; the Top-ups and Renewals filters count and filter by category. |
| **Recheck a pending payment**: `POST /transactions/:reference/verify` | `VITE_FLAG_VERIFY_PAYMENT` | "Check status" on a pending payment re-reads it with `GET /transactions/:id` ("Still pending. It'll update here as soon as Paystack confirms."). | "Check status" asks Paystack again through the API ("Checked with Paystack: … is still waiting for the bank to confirm."). |
| **Reminder settings**: `GET` and `PUT /users/notification-preferences` | `VITE_FLAG_REMINDER_SETTINGS` | Settings has no Reminders card; Home's wallet card has no auto-renew line. | The Reminders card: email, SMS and WhatsApp switches, which days before expiry (30, 14, 7, 1), auto-renew. |

## Gaps without a flag (the app falls back by itself)

| Gap | What the app does today | When it ships |
| --- | --- | --- |
| **`GET /users/me`** | Uses the user from the sign-in response, saved with the session. On a 404 it keeps that copy. | Settings and the sidebar show changes made on another device; no app change needed. |
| **Prices**: `GET /pricing` | Shows the placeholder prices from the design (`DEFAULT_PRICING` in `packages/api/src/schemas/gaps.ts`): tracking ₦2,500; renewal: licence ₦18,500, third-party insurance ₦15,000, roadworthiness ₦6,500. Comprehensive cover has no price ("Quoted by our team"). **Confirm these with the owner before launch.** | The app shows the API's prices; no app change needed. |
| **Duplicate plate**: `409` from `POST /vehicles` | Checks the plate against `GET /vehicles` before saving (spaces, dashes and case ignored). | A plate added from another device is caught too; no app change needed. |

## Backend work that needs no flag

From the plan's backend list (`docs/build-plan.html`) and `docs/backend-handoff.md`. Ordered by
what blocks launch.

| Item | Why it matters | App side |
| --- | --- | --- |
| **Google sign-in is down: the OAuth client was deleted** (checked 15 Oct 2026). Google answers `Error 401: deleted_client` for the client ID all three `ijanla` slots share. Create a new Web OAuth client in the Google Cloud project (`GOOGLE_OAUTH_PROJECT_ID`), add the redirect addresses below, then set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` on each slot. Also: production's `GOOGLE_OAUTH_REDIRECT_URLS` points at `www.motorpapers.com`, which isn't registered, so use `https://memininode.azurewebsites.net/complete-onboard` until the domain is back (stage and dev already use their `memininode-*` addresses). The live and stage APIs also put `action=[object Object]` in the redirect. | Nobody can sign up or sign in with Google, on the old app or the new one | Ready. Works with the live API's `platform` / `oauth_platform` and ijanla-dev's `type` / `oauth_type`, and with the broken `action` (it remembers what it asked for) |
| **New domains**: CORS, Google redirect, Paystack callback | Nothing works on `app.<domain>` without it | Ready. Steps in `runbook.md` §5–7 |
| **Paystack webhook is the source of truth** (signature check, safe twice) | The payment page waits for it before showing "Payment received" | Ready |
| **Reminder job and emails** | The reason drivers sign up | Templates ready in `emails/`; events and values in `docs/backend-handoff.md` |
| **Longer sessions** (refresh token or sliding session) | Tokens last 30 minutes, so a driver halfway through Add a car can be sent to sign in | Built for 30 minutes; a refresh endpoint would need a small change in `apps/web/src/stores/session.ts` |
| **Renewal requests for the team** (`pay_with: "team"` on renewals, or `POST /renewal-requests`) | Comprehensive cover is priced on the car's value, and while renewals are off there's nowhere to send a request, so the app asks drivers to call or WhatsApp | Needs a small app change to send the request when it exists (`docs/backend-handoff.md` §2) |
| **Protect the document reader** (same token as the API, or a rate limit; confidence per field) | Anyone with the address can send it images today | Sends no token today; adding one is a small change in `packages/api/src/docReader.ts` |
| **Link Google to an existing account** (`action=link`, `google_connected` on the user) | Settings' Connect can't truly link, or show "Connected" | `docs/backend-handoff.md` §4 |
| **Pricing for comprehensive cover** (a quote) | Comprehensive renewals go through a phone call | — |
