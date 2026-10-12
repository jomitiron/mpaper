# Backend handoff: emails, renewals and Settings

The email templates in `emails/` are finished and are sent by the backend (Handlebars, see
`emails/README.md`). This page lists which event sends which template, and every value the web app
can supply so the backend doesn't have to guess: links into the app, the words it uses, colours and
formats. The last section lists what the app still needs from the API for renewals and Settings.

`APP` below is the web app's address for the environment (`VITE_APP_URL`: dev, staging,
production).

## Events and templates

| Event | Template | Notes |
| --- | --- | --- |
| `POST /users/sign-up`, `POST /users/resend-verification-email` | `verify-email.html` | Exists today; restyled. |
| `POST /users/forgot-password` | `reset-password.html` | Exists today; restyled. |
| `POST /users/verify-email` succeeds | `welcome.html` | Once per account. |
| Daily reminder job: a paper's `expiry_date` is N days away, N in the driver's `lead_days` | `reminder-due.html` | See "Reminders" below. |
| Daily reminder job: the day after `expiry_date`, then weekly, 3 times at most | `paper-expired.html` | See "Reminders" below. |
| Paystack webhook marks a transaction `success` | `payment-received.html` | Top-ups, the tracking fee and renewals. |
| Paystack webhook marks a transaction `failed` | `payment-failed.html` | |
| A renewal's `status` changes to `paid`, `processing`, `out_for_delivery` or `delivered` | `renewal-update.html` | See "Renewal updates" below. |
| `POST /users/password` or `POST /users/reset-password` succeeds | `password-changed.html` | |

### Reminders

- Send to each channel the driver has on in `GET /users/notification-preferences` (`email`,
  `sms`, `whatsapp`), on the days in `lead_days`. Until that endpoint exists, use email and SMS on
  30, 14 and 7 days. The design also offers 1 day.
- **Don't remind about a paper that's being renewed** (a renewal for that car and paper in `paid`,
  `processing` or `out_for_delivery`). The app shows "Renewal in progress" for it instead.
- Stop once the paper has a newer `expiry_date` (the driver updated it, or a renewal was delivered).
- `auto_renew` on: 14 days before expiry, start a renewal paid from the wallet
  (`pay_with: "wallet"`) when the balance covers it and none is in progress; otherwise send the
  normal reminder. This is what Settings promises: "Pay from your wallet when a paper is 14 days
  from expiry."

### Renewal updates

`renewal-update.html` is written for **out for delivery**: its subject is "Your new
{{document_name_lower}} for {{plate_number}} is on its way" and it opens "We've renewed the … and
it's out for delivery." Either send it only for `out_for_delivery` and `delivered`, or give it a
headline and opening line per status. The app uses these, which can go in as-is:

| Status | Headline | Line under it |
| --- | --- | --- |
| `paid` | Your {{document_name_lower}} renewal is paid | We'll start on it shortly and email you at each step. |
| `processing` | We're renewing your {{document_name_lower}} | We'll email you when it's on its way to you. |
| `out_for_delivery` | Your new {{document_name_lower}} is on its way | It's with our delivery team. We'll email you when it's delivered. |
| `delivered` | Your new {{document_name_lower}} has been delivered | It's on your car's papers, so your reminders start again from its new date. |

`steps` is always four items, Paid, Processing, Out for delivery, Delivered, styled with the
done / current / todo colours in `emails/README.md`. The app marks them like this, and the email
should match:

| Status | Paid | Processing | Out for delivery | Delivered |
| --- | --- | --- | --- | --- |
| `paid` | done | todo | todo | todo |
| `processing` | done | current | todo | todo |
| `out_for_delivery` | done | done | current | todo |
| `delivered` | done | done | done | done |

`delivery_area` is the area part of the address ("Lekki Phase 1"). The app only has one free-text
address (`users.address`, copied to `renewal.delivery_address`), so take the part before the last
comma, or leave the preview line out when there isn't one.

## Values the app supplies

### Links into the app

| Variable | Address | Opens |
| --- | --- | --- |
| `renew_url` | `APP/cars/{vehicle_id}/renew/{paper}` | The renew page with the car and paper chosen |
| `track_url` | `APP/cars/{vehicle_id}/renew/{paper}` | The same page: it shows the tracker while a renewal is under way |
| `update_url` | `APP/cars/{vehicle_id}` | The car panel, where the driver updates a paper's date |
| `settings_url` | `APP/settings` | Settings, with the reminder settings |
| `payments_url` | `APP/payments` | Payments |
| `retry_url` | Top-up: `APP/payments?topup=1&amount={amount}`. Renewal: its `renew_url`. Tracking fee: `APP/cars/new` | Pays again |
| `add_car_url` | `APP/cars/new` | Add a car |
| `reset_url` (reset-password) | `APP/reset-password?email={email}&otp={otp}` | Reset password, filled in |
| `reset_url` (password-changed) | `APP/forgot-password` | "Wasn't you?": start a reset |

`{paper}` is `licence`, `insurance` or `roadworthiness` (for `document_type` `vehicle_license`,
`insurance`, `roadworthiness`). Paystack's callback URL must be `APP/payments/callback`.

### Words

| Variable | Values |
| --- | --- |
| `document_name` | Vehicle licence, Insurance, Roadworthiness |
| `document_name_lower` | vehicle licence, insurance, roadworthiness |
| `document_label` | The tile's label: "Vehicle licence", "Insurance · Third party", "Insurance · Comprehensive", "Roadworthiness" |
| `vehicle_name` | `{brand} {model}`, e.g. Ford Edge |
| `plate_number` | As stored, e.g. EKY 219 GD |
| `description` (payments) | Wallet top-up, Tracking and reminders, Licence renewal, Insurance renewal, Roadworthiness renewal (the same labels as `GET /transactions` with `category`, api-gaps.md) |
| `payment_method` | Card, Bank transfer (Paystack's channel) or Wallet |
| `support_phone` | +234 802 959 5069 |

### Formats and colours

- Money in naira with no kobo: `₦18,500`. Dates in Lagos time: `20 Oct 2026`. Days: `1 day`,
  `9 days`.
- `doc_tile_bg` / `doc_tile_color` per paper, and the `steps` colours: `emails/README.md`.

## What the app still needs from the API

These are on top of `docs/phases/api-gaps.md`. The app is built against the mocks for each.

1. **Renewals** (`VITE_FLAG_RENEWALS`): `POST /vehicles/:id/renewals`, `GET /renewals`,
   `GET /vehicles/:id/renewals` as in api-gaps.md, plus:
   - Return Paystack's `reference` next to `auth_url` when paying by card (as
     `POST /transactions/initialize` does). The app keys "what was this payment for" on it, so the
     receipt can say "Licence renewal · EKY 219 GD" and link back to the renewal.
   - A card payment that fails or is abandoned should move the renewal to `cancelled`, so it
     doesn't sit in `awaiting_payment`. (The app ignores `awaiting_payment` renewals older than a
     day.)
   - `pay_with: "wallet"` with too little balance: `400` with "Insufficient balance".
   - When a renewal is delivered, add the new paper to the car (so `GET /vehicles` shows its new
     `expiry_date`) and set `new_expiry_date`.
2. **Request renewal** (the fallback while renewals are off, and for comprehensive cover, which is
   priced on the car's value): the app has nowhere to send it. Today the request is kept in the
   driver's browser only, and the app tells them the team will call, so **nothing reaches the team
   yet**. Add something that records it for the team, such as `POST /vehicles/:id/renewals` with
   `pay_with: "team"` (no payment; a new `requested` status), or
   `POST /renewal-requests { vehicle_id, document_type, delivery_address, phone }`, and alert the
   team (email or a dashboard).
3. **Prices** (`GET /pricing`): including a way to price comprehensive cover (a quote).
4. **Google**: there's no way to link Google to an account made with email and password. Settings'
   Connect goes through Google sign-in (`action=signin`) and back to `/settings`; that only works if
   the API matches a Google account to an existing account by email, and it can't show
   "Connected". Add `action=link` to `GET /users/oauth-url` (or `POST /users/oauth-link` with
   `oauth_code` and `oauth_type`) and a `google_connected` flag on the user.
5. **Profile**: `PUT /users` takes `first_name`, `last_name`, `phone` and `address` and returns the
   whole user. `GET /users/me` (api-gaps.md) so Settings shows changes made on another device.
6. **Reminder settings** (`VITE_FLAG_REMINDER_SETTINGS`): `GET` and `PUT
   /users/notification-preferences` as in api-gaps.md. `PUT` takes the whole object; `lead_days`
   from 30, 14, 7 and 1, at least one.
