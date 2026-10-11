# API mocks

MSW handlers for every documented MotorPapers endpoint, the missing endpoints in
`docs/phases/api-gaps.md`, and the document reader. The web app turns them on with
`VITE_USE_MOCKS=true` (the default in `apps/web/.env.development`).

```ts
import { createHandlers, createMockDb } from '@motopapers/api/mocks';
const handlers = createHandlers({ baseUrl: 'https://api.test', db: createMockDb() });
```

In the browser the data lives in `sessionStorage`, so it survives the trip to the mock Paystack
checkout and back. Reset it from the console with `__motopapersMocks.reset()`.

## Sample account

| Email | Password |
| --- | --- |
| `ada.okafor@example.com` | `password123` |

Ada has the four cars, wallet balance (₦8,500) and payments from the design. Expiry dates are set
relative to today, so the statuses always match the design: KJA 731 AE insurance due in 9 days,
EKY 219 GD licence expired 13 days ago, APP 105 BC with insurance and roadworthiness not tracked.

Sign up creates a new, empty account. Tokens are JWT-shaped (unsigned) and expire after 30
minutes, like the real ones; an expired or missing token gets a 401.

## Special values

| What | Value | Result |
| --- | --- | --- |
| Verify email / reset password code | `000000` | 400 "Invalid OTP" (`is_expired: false`) |
| | `999999` | 400 "Expired OTP" (`is_expired: true`) |
| | any other 6 digits | Works |
| Sign in | wrong password or unknown email | 401 "Invalid credentials" |
| Change password | wrong `old_password` | 400 "Invalid old password" |
| Google / Facebook | `GET /users/oauth-url` | Returns `<app>/auth/callback?code=mock-oauth-code&state=moto`; that code signs in as Ada |
| Paystack amount ending in `13` (₦1,013) | | Payment fails |
| Paystack amount ending in `99` (₦1,099) | | Payment never settles (tests the 2-minute timeout) |
| Any other amount | | Payment succeeds after 1.5 s |
| Add a car with a plate already on the account | | 409 (planned backend behaviour) |
| Pay from wallet or renew by wallet with too little balance | | 400 "Insufficient balance" |

`POST /transactions/initialize` returns an `auth_url` that goes straight to
`<app>/payments/callback?reference=…`, as Paystack would after a payment. The live stream
`GET /transactions/completed-payment/:reference` sends the result once it settles.

A renewal moves on by itself after it's paid: processing after 20 s, out for delivery after 40 s,
delivered after 60 s, when the car gets a new paper valid for one more year.

The document reader returns the design's sample licence (KTU 604 XR, Toyota Corolla) for any
image after about a second.

## What's assumed

These responses aren't in the API docs, so the mocks make a reasonable guess. Don't build UI that
depends on the exact wording:

- `DELETE /vehicles/:id` → 200 "Vehicle deleted successfully".
- Signing up with an email that's already registered → 400.
- `GET …/valid-document` with no valid record → 200 with `data: null`.
- An expired or missing token → 401 `{ "message": "Unauthorized", "status": "error" }`.
