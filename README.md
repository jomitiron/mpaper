# MotoPapers

The rebuild of MotoPapers: track and renew a vehicle licence, insurance and roadworthiness certificate,
with reminders before each one expires. This repo holds the new web app, the marketing site, the
transactional emails and the plan for building them on the existing MotorPapers API.

## What's here today

| Folder | What it is |
| --- | --- |
| `docs/build-plan.html` | The phased build and deployment plan. Open it in a browser. |
| `design/motopapers-site.html` | The approved design (Direction C): landing page, sign in, sign up and every app screen, clickable. |
| `design/motopapers-directions.html` | The three design directions that were compared. |
| `emails/` | Nine transactional email templates (HTML with Handlebars placeholders) and a README for the backend. |

To run the app and site locally, and to set up deploys, see [`docs/setup.md`](docs/setup.md).

Code arrives phase by phase, following the plan:

| Phase | Milestone | Weeks |
| --- | --- | --- |
| 0 | Foundations: monorepo, design tokens, components, API client, CI and deploys | 1 |
| 1 | Sign-in: sign up, verify email, sign in, Google, password reset | 2 |
| 2 | Cars: Home, My cars, car panel, Add a car with the document reader | 3–4 |
| 3 | Payments: Paystack, payment return, Payments page, top-up | 4–5 |
| 4 | Renewals and reminders: Renew flow, reminder emails, Settings | 5–7 |
| 5 | Marketing site (in parallel) | 3–6 |
| 6 | QA and launch: beta, then the domain switch | 7–8 |

## Planned layout

```
apps/web        Vue 3 + TypeScript app       → app.<domain>
apps/site       Astro marketing site         → <domain>
packages/tokens colours, type, radii from the design
packages/ui     shared components
packages/api    typed API client + Zod schemas
emails/         email templates
design/         approved prototype
docs/           plan
```

## API

- Docs: https://omitirand.gitbook.io/motorpapers-api/
- Base URLs: `ijanla-dev` (preview), `ijanla-stage` (staging), `ijanla` (production) on azurewebsites.net
- The document reader that reads licence photos is a separate service and isn't in the API docs yet.
  See the plan for its request and response format.
