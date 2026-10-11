# Phase 1 · Sign-in

Branch: `phase-1/sign-in` · Port: 5171 · Depends on: P0 · Runs in parallel with: P2, P5

## Goal
Drivers can create an account, verify their email, sign in (email or Google), reset a forgotten
password, and stay signed in across refreshes until the token expires.

## You own
`apps/web/src/features/auth/**` (pages, components, composables, `routes.ts`, tests) and the
`session` Pinia store implementation in `apps/web/src/stores/session.ts` (P0 leaves a stub with the
interface: `token`, `user`, `isSignedIn`, `setSession()`, `signOut()`, `restore()`). Keep that
interface stable; P2 and P3 read it.

## Build (match the design's Sign in and Sign up screens)
- `/sign-up`: three steps with the progress bars: Account (first name, last name, phone with +234,
  email, password with rules), Verify email (6 OTP boxes, paste support, resend with a 60 s cooldown),
  First car (upload card → link to `/cars/new`, "Skip for now" → `/`).
  Calls: `POST /users/sign-up`, `POST /users/verify-email` (returns the token), `POST /users/resend-verification-email`.
- `/sign-in`: email + password, "Forgot password?", Google button.
  Calls: `POST /users/sign-in`, `GET /users/oauth-url?platform=google&action=signin|signup`.
- Google: redirect to the returned URL. Add `/auth/callback` that reads `code` from the query and calls
  sign-in/sign-up with `oauth_code` + `oauth_platform`. Note in the PR that the backend must redirect
  back to this route.
- `/forgot-password` (email) → `/reset-password` (OTP + new password), `is_expired` handling.
- Session: store token + user (sessionStorage by default, "Keep me signed in" → localStorage), decode
  `exp` from the JWT and sign out when it passes; `restore()` on app start (try `GET /users/me` mock,
  fall back to the stored user). Wire the 401 hook from `packages/api` to `signOut()` + redirect
  with `next`.
- Sign out: `POST /users/sign-out`, then clear and go to `/sign-in`.
- The coral art panel with the phone mock on wide screens, form only on phones.
- Errors in plain language from the API `message`, inline under fields where possible.

## Tests
Unit tests for the session store (restore, expiry, signOut) and form validation. Component tests for
the OTP input (typing, paste, backspace).

## Done when
A new account can be created, verified and used against `ijanla-dev` (or mocks), and refreshing the
page keeps you signed in. Lint, typecheck, test and build pass.
