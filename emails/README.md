# MotoPapers emails

Transactional email templates for the MotoPapers API. Each file is complete, email-client-safe HTML
(table layout, inline styles, 600px wide, light theme only) with Handlebars placeholders.

Render with Handlebars on the server, then send through your email provider. Always send a plain-text
part alongside the HTML.

| File | Subject | Sent when | Status | Variables |
| --- | --- | --- | --- | --- |
| `verify-email.html` | Your MotoPapers code: {{otp}} | POST /users/sign-up and POST /users/resend-verification-email | Exists · restyle | `otp_expiry_minutes`, `first_name`, `otp` |
| `reset-password.html` | Reset your MotoPapers password | POST /users/forgot-password | Exists · restyle | `otp`, `email`, `reset_url`, `otp_expiry_minutes` |
| `welcome.html` | Welcome to MotoPapers, {{first_name}} | After POST /users/verify-email succeeds | New | `first_name`, `add_car_url` |
| `reminder-due.html` | {{document_name}} for {{plate_number}} expires in {{days_left}} days | Daily reminder job, 30, 14, 7 and 1 days before expiry_date | New | `document_name_lower`, `first_name`, `vehicle_name`, `expiry_date`, `doc_tile_bg`, `doc_tile_color`, `document_label`, `days_left`, `plate_number`, `renew_url`, `wallet_balance`, `update_url`, `settings_url`, `document_name` |
| `paper-expired.html` | Action needed: {{document_name}} for {{plate_number}} has expired | Daily reminder job, the day after expiry_date, then weekly up to 3 times | New | `expiry_date`, `document_name_lower`, `plate_number`, `vehicle_name`, `document_name`, `days_since`, `renew_url`, `support_phone`, `settings_url` |
| `payment-received.html` | Payment received: {{amount}} | Paystack webhook marks a transaction success | New | `description`, `reference`, `amount`, `first_name`, `payment_method`, `paid_at`, `wallet_balance`, `payments_url` |
| `payment-failed.html` | Your payment of {{amount}} didn't go through | Paystack webhook marks a transaction failed | New | `amount`, `description_lower`, `failure_reason`, `reference`, `paid_at`, `retry_url` |
| `renewal-update.html` | Your new {{document_name_lower}} for {{plate_number}} is on its way | Renewal order changes status (paid, processing, out for delivery, delivered) | Needs renewals API | `delivery_area`, `document_name_lower`, `first_name`, `vehicle_name`, `plate_number`, `document_name`, `new_expiry_date`, `delivery_address`, `track_url`, `steps[] (label, bg, color, mark, text_color)` |
| `password-changed.html` | Your MotoPapers password was changed | POST /users/password and POST /users/reset-password succeed | New | `first_name`, `email`, `changed_at`, `reset_url` |

## Paper colours (reminder-due)

Pass these as `doc_tile_bg` / `doc_tile_color` so the reminder tile matches the app:

| Paper | doc_tile_bg | doc_tile_color |
| --- | --- | --- |
| Vehicle licence | #E4EDFF | #2453CF |
| Insurance | #DCF5E9 | #0A7647 |
| Roadworthiness | #FFEFC4 | #7F5300 |

## Renewal tracker steps (renewal-update)

`steps` is an array of four objects in order (Paid, Processing, Out for delivery, Delivered):

| State | bg | color | mark | text_color |
| --- | --- | --- | --- | --- |
| done | #0A7647 | #FFFFFF | `&#10003;` | #1E1B33 |
| current | #FF5A3C | #FFFFFF | `&#9679;` | #1E1B33 |
| todo | #E6E4EF | #6A6783 | `&#9675;` | #6A6783 |

## Before sending from production

- Replace the "M" letter mark with a hosted PNG logo (at least 2x size) if you prefer an image logo.
- Set up SPF, DKIM and DMARC for the sending domain.
- Use a real reply-to inbox; several emails invite users to reply.
