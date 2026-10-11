# API gaps — mock shapes

These endpoints don't exist yet. Mock them with MSW in `packages/api` using exactly these shapes, and
hide the UI that depends on them behind the named flag. When the backend ships them, only the mocks go.

All responses use the API's envelope: `{ "status": "success", "message": "...", "data": ... }`.

## GET /users/me — flag: none (fallback: user from sign-in response)
`data`: same user object as sign-in (`id, first_name, last_name, email, phone, address, email_verified, wallet{id,balance}, created_at`).

## Transaction labels — flag: `VITE_FLAG_TX_LABELS`
`GET /transactions` items gain:
`category`: `wallet_topup | service_charge | subscription_charge | renewal`,
`description`: string (e.g. "Licence renewal"), `vehicle_id`: number | null,
`document_type`: `vehicle_license | insurance | roadworthiness | null`.
Without the flag, label by `transaction_type` (credit → "Wallet top-up", debit → "Payment").

## Pay from wallet — flag: `VITE_FLAG_WALLET_PAY`
`POST /wallets/debit` body `{ amount, category, vehicle_id?, document_type? }` →
`data: { transaction, wallet: { balance } }`. `400` with `message: "Insufficient balance"` when short.

## Renewals — flag: `VITE_FLAG_RENEWALS`
`POST /vehicles/:id/renewals` body `{ document_type, pay_with: "wallet" | "card", delivery_address }` →
`data: { renewal, auth_url? }` (auth_url when paying by card).
`GET /renewals` and `GET /vehicles/:id/renewals` → `data: renewal[]`.
`renewal`: `{ id, vehicle_id, document_type, status: "awaiting_payment" | "paid" | "processing" | "out_for_delivery" | "delivered" | "cancelled", amount, delivery_address, new_expiry_date | null, created_at, updated_at }`.

## Pricing — flag: none (fallback constants)
`GET /pricing` → `data: { tracking_fee: 2500, renewal: { vehicle_license: 18500, insurance_third_party: 15000, roadworthiness: 6500 } }`.
These numbers are placeholders from the design. Show them, but keep them in one place.

## Notification preferences — flag: `VITE_FLAG_REMINDER_SETTINGS`
`GET` / `PUT /users/notification-preferences` →
`data: { email: true, sms: true, whatsapp: false, lead_days: [30, 14, 7], auto_renew: false }`.

## Verify a pending payment — flag: `VITE_FLAG_VERIFY_PAYMENT`
`POST /transactions/:reference/verify` → `data: transaction` (with refreshed `status`).

## Duplicate plate
Real `POST /vehicles` may not return 409 yet. Also check client-side against `GET /vehicles`
(compare plates with spaces and dashes removed, case-insensitive).
