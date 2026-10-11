# Phase 5 · Marketing site

Branch: `phase-5/site` · Port: 4321 · Depends on: P0 · Runs in parallel with: P1, P2

## Goal
The landing page from the approved design, built as a fast static Astro site that ranks on Google and
sends people into the app.

## You own
`apps/site/**`. Use `packages/tokens`. Do not touch `apps/web`.

## Build (match the design's Landing screen exactly, section by section)
- Hero: gradient panel with the nav inside (logo, section links, Sign in, Get started), "New" announce
  pill, headline with the coral phrase, lede, two CTAs, three ticks, and the stage: phone mock in the
  middle, fanned paper cards, two floating notifications with dashed connector lines. Respect
  `prefers-reduced-motion` for the rise animation. Build the phone mock in HTML/CSS as the design does.
- Payments strip, "When does your car insurance expire?" with the reminders list, How it works (4 steps),
  Three papers, three colours, Why MotoPapers (wallet card + six ticks), FAQ (native `<details>`),
  closing coral band, footer with the address and phone number.
- Responsive exactly like the design at 1440, 1024, 820 and 375 widths. No horizontal scroll.
- CTAs link to `PUBLIC_APP_URL/sign-up` and `/sign-in`.
- `/privacy` and `/terms` pages with clearly marked placeholder text for the owner to replace.
- SEO: title, description, canonical, Open Graph/Twitter tags, a social preview image (build it as an
  Astro-rendered 1200×630 PNG or static SVG→PNG), `sitemap.xml`, `robots.txt`, JSON-LD Organization.
- Analytics hook: a single `PUBLIC_ANALYTICS_DOMAIN` env for Plausible (off when unset). No cookie
  banner needed for Plausible; note this in the PR.
- No client JS except what's strictly needed (none expected).

## Done when
Lighthouse (mobile) on the built site scores 90+ for performance, accessibility, best practices and
SEO, the page matches the design at all four widths, and lint/typecheck/build pass.
