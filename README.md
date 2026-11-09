# TenderMed Intelligence

Public Slovenian-language website and interactive product demonstration for **TenderMed Intelligence**, a platform under development that connects medical equipment records, service coordination, relevant product recommendations and procurement intelligence.

This repository is the **first public release**: a marketing website, an interactive demo with clearly fictional data, and working inquiry forms backed by Supabase. It is **not** a production equipment-management application.

> Medcore is a separate distribution business and is not an alternative name for this platform. Nothing in this repository assumes a distribution agreement, customer, partnership, certification, live tender integration or validated AI capability.

---

## Contents

1. [Working assumptions](#working-assumptions)
2. [Product scope and non-goals](#product-scope-and-non-goals)
3. [Demonstrated vs. implemented](#demonstrated-vs-implemented)
4. [Technical stack](#technical-stack)
5. [Project structure](#project-structure)
6. [Local installation](#local-installation)
7. [Environment variables](#environment-variables)
8. [Supabase setup and migrations](#supabase-setup-and-migrations)
9. [Security model](#security-model)
10. [Testing](#testing)
11. [Deploying to Vercel](#deploying-to-vercel)
12. [How the demo data works](#how-the-demo-data-works)
13. [Recommendation and tender matching](#recommendation-and-tender-matching)
14. [Editing Slovenian copy](#editing-slovenian-copy)
15. [Adding a platform module](#adding-a-platform-module)
16. [Adding products and matching rules](#adding-products-and-matching-rules)
17. [Launch checklist](#launch-checklist)
18. [Known limitations](#known-limitations)
19. [Future authenticated application](#future-authenticated-application)

---

## Working assumptions

The repository was empty when work started, so these defaults were chosen and are documented here:

| Topic                                   | Assumption                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Platform name                           | TenderMed Intelligence                                                                                                                |
| Initial market / industry               | Slovenia; medical equipment and healthcare                                                                                            |
| Primary audience                        | Healthcare organizations managing equipment and coordinating maintenance                                                              |
| Secondary audience                      | Distributors, service providers and manufacturers                                                                                     |
| Website language                        | Slovenian (all visitor-facing text). Code, comments and this README are in English.                                                   |
| First release                           | Marketing site, interactive demo with fictional data, inquiry forms stored in Supabase                                                |
| Domain, legal entity, contact details   | **Unknown** – kept as `null` placeholders in `src/lib/config/site.ts`; nothing is invented or rendered                                |
| Medcore                                 | Separate business; optional footer link only if configured                                                                            |
| Customers, partners, certifications, AI | None assumed or claimed                                                                                                               |
| Hosting                                 | Vercel (app) + Supabase (database)                                                                                                    |
| Analytics / trackers                    | None                                                                                                                                  |
| Response-time promise for inquiries     | None (configurable via `siteConfig.inquiryResponseTimeText`)                                                                          |
| Pilot sign-up                           | E-mail address only (no name, interest area, message or marketing consent); shown at the top of the homepage and in the pilot section |

## Product scope and non-goals

### In this release

- Premium public website (`/`) with separate messaging for healthcare organizations and distribution partners.
- Interactive demo (`/demo`) with fictional equipment, service records, recommendations and illustrative tenders. State lives only in browser memory.
- Working e-mail-only pilot sign-up form (top of the homepage and pilot section) and contact form (`/api/demo-request`, `/api/contact`) with server-side validation, honeypot, origin check, body-size limit, durable rate limiting and optional Cloudflare Turnstile.
- Supabase migrations with RLS, constraints, deduplication and rate limiting.
- Draft privacy notice (`/zasebnost`) and terms (`/pogoji`), clearly marked as drafts and `noindex`.
- SEO metadata, sitemap, robots, social image, icons; accessibility and responsive layouts; unit and end-to-end tests.

### Explicit non-goals (prepared, not built)

Authentication and invitations · persistent customer equipment registers · real service-provider collaboration · scheduled e-mail/SMS reminders · document uploads · live manufacturer feeds · AI document processing · live e-Naročanje or TED ingestion · subscriptions/payments · rental transactions · used-equipment marketplace · automatic purchasing or tender submission · e-mail notifications for inquiries.

No button or label in the UI implies that these exist.

## Demonstrated vs. implemented

| Capability                                                                                                     | Status in this release                                                 | Label on the website                         |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Equipment register (search, filters, detail drawer, service history, document metadata)                        | Interactive demo, in-memory, fictional data                            | Interaktivni demo                            |
| Service requests (structured creation, propose vs. confirm date, status, timeline, separate completion record) | Interactive demo, in-memory                                            | Interaktivni demo                            |
| Documentation                                                                                                  | Metadata only, no files, no downloads                                  | V razvoju                                    |
| Product recommendations                                                                                        | Deterministic rules engine with explanations and commercial disclosure | Interaktivni demo                            |
| Tender matching                                                                                                | Deterministic rules on illustrative tenders; no live sources           | Interaktivni demo (live sources: Načrtovano) |
| Pilot / contact inquiries                                                                                      | **Implemented** – stored in Supabase when configured                   | –                                            |
| Authentication, reminders, uploads, live integrations                                                          | Not implemented                                                        | V razvoju / Načrtovano                       |

## Technical stack

| Layer               | Choice                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js 16.4 (App Router, Turbopack, Cache Components, Partial Prefetching)                                                                         |
| Language            | TypeScript 5.9, `strict` + `noUncheckedIndexedAccess`                                                                                               |
| Styling             | Tailwind CSS 4 (CSS-first tokens in `src/app/globals.css`), shadcn-style primitives written in-repo with `class-variance-authority`                 |
| Accessible overlays | Radix Dialog (focus trap, Escape, focus return)                                                                                                     |
| Icons               | lucide-react                                                                                                                                        |
| Fonts               | Inter (UI), Schibsted Grotesk (headings), JetBrains Mono (serial numbers) via `next/font/google` – self-hosted at build time, `latin-ext` for č/š/ž |
| Validation          | Zod 4 (shared by browser and server)                                                                                                                |
| Database            | Supabase (PostgreSQL) via `@supabase/supabase-js`, server-only                                                                                      |
| Tests               | Vitest 5 (unit), Playwright 1.63 (end-to-end)                                                                                                       |
| Lint / format       | ESLint 9 with `eslint-config-next`, Prettier                                                                                                        |
| Deployment          | Vercel                                                                                                                                              |

TypeScript 6/7 were not used because `typescript-eslint` (required by `eslint-config-next`) supports TypeScript `<6.1`. ESLint 10 was not used because several React ESLint plugins declare `eslint ^9` as their maximum.

## Project structure

```text
src/
  app/
    layout.tsx                 Root layout: lang="sl", fonts, metadata, skip link
    globals.css                Design tokens and base styles
    (marketing)/               Public pages sharing header + footer
      page.tsx                 Homepage (static, revalidated daily)
      zasebnost/page.tsx       Privacy notice (draft, noindex)
      pogoji/page.tsx          Terms (draft, noindex)
    demo/
      layout.tsx               App-style shell with persistent demo notice
      page.tsx                 Partial prerender; workspace computed per request
    api/demo-request/route.ts  Pilot inquiry endpoint (POST only)
    api/contact/route.ts       Contact endpoint (POST only)
    robots.ts, sitemap.ts, not-found.tsx, icon.svg, apple-icon.png, opengraph-image.png
  components/
    layout/                    Header, mobile navigation, footer, brand
    marketing/                 Homepage sections, legal page layout, hero preview
    demo/                      Demo workspace, views, drawers, dialogs, status badges
    forms/                     Pilot and contact forms, submission hook, Turnstile
    ui/                        Button, badge, dialog, form controls, section, container
  data/
    demo/                      Fictional dataset (time-relative), notices
    marketing/                 Slovenian homepage copy, FAQ, navigation
  features/
    equipment/                 Maintenance due dates and statuses, labels
    service/                   Service request labels
    recommendations/           Deterministic recommendation rules, labels
    tenders/                   Deterministic tender rules
    matching/                  Engine adapter interface
    demo/                      Demo reducer, selectors, snapshot loader, views
  lib/
    config/                    Site config, server env, SEO helpers
    dates/                     Date-only arithmetic, formatting, reference date
    forms/                     Framework-independent inquiry handler, response contract
    repositories/              Persistence interfaces + Supabase implementation
    security/                  Request guards, Turnstile verification
    supabase/                  Server-only admin client
    validation/                Zod schemas
    utils/                     cn(), Slovenian plurals, number formatting
  types/domain.ts              Domain models
supabase/
  migrations/                  SQL migrations
  tests/verify_inquiries.sql   SQL assertions used by scripts/verify-migrations.sh
scripts/verify-migrations.sh   Applies migrations to a throwaway local PostgreSQL
tests/
  unit/                        Vitest
  e2e/                         Playwright
```

## Local installation

Requirements: Node.js ≥ 20.9 (developed with Node 22), npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The site runs at <http://localhost:3000>. Without Supabase variables, the marketing pages and the demo work; the forms show an honest "Pošiljanje obrazcev trenutno ni na voljo" error and never a success message.

Useful scripts:

| Script                           | Purpose                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `npm run lint`                   | ESLint                                                                     |
| `npm run typecheck`              | Generates route types, then `tsc --noEmit`                                 |
| `npm test`                       | Vitest unit tests                                                          |
| `npm run test:e2e`               | Playwright (builds and starts the app on port 3100)                        |
| `npm run build`                  | Production build                                                           |
| `npm run check`                  | lint + typecheck + unit tests + build                                      |
| `npm run format`                 | Prettier                                                                   |
| `./scripts/verify-migrations.sh` | Applies migrations to a temporary local PostgreSQL and runs SQL assertions |

## Environment variables

| Variable                                                  | Required   | Exposure        | Purpose                                                                                                                   |
| --------------------------------------------------------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                    | For launch | Public          | Canonical origin. Enables canonical URLs, sitemap, indexing and `metadataBase`. Leave empty until the real domain exists. |
| `NEXT_PUBLIC_SUPABASE_URL`                                | For forms  | Public          | Supabase project URL                                                                                                      |
| `SUPABASE_SECRET_KEY`                                     | For forms  | **Server only** | Supabase secret key (`sb_secret_…`)                                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`                               | Fallback   | **Server only** | Legacy service-role JWT, only if no secret key is available                                                               |
| `RATE_LIMIT_HASH_SECRET`                                  | Optional   | Server only     | HMAC key for pseudonymizing IP/e-mail in rate limits (defaults to the Supabase secret)                                    |
| `FORM_ALLOWED_ORIGINS`                                    | Optional   | Server only     | Extra origins allowed to POST forms (comma-separated)                                                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Optional   | Public / server | Cloudflare Turnstile. Set both or neither.                                                                                |
| `DEMO_REFERENCE_DATE`                                     | Optional   | Server only     | Pins the demo "today" (`YYYY-MM-DD`) for screenshots                                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                    | Not used   | Public          | Reserved for a future browser/Auth integration                                                                            |

Privileged keys are read only in `src/lib/config/server-env.ts`, which imports `server-only`; importing it from client code fails the build.

## Supabase setup and migrations

No Supabase project was created as part of this work. To connect one:

1. **Create a project** in the Supabase dashboard. Choose the region deliberately (see the launch checklist; an EU region is the usual choice for Slovenian users, but this is a decision for the operator).
2. **Copy credentials** from the project's API settings: the project URL → `NEXT_PUBLIC_SUPABASE_URL`, a secret key → `SUPABASE_SECRET_KEY`. Do not use the publishable key for the forms.
3. **Apply the migration** in `supabase/migrations/` using either:
   - the Supabase CLI:

     ```bash
     npx supabase login
     ```

     ```bash
     npx supabase link --project-ref <project-ref>
     ```

     ```bash
     npx supabase db push
     ```

   - or the dashboard SQL editor: paste and run each file in `supabase/migrations/` once, in filename order (`20261108120000_inquiries.sql`, then `20261109120000_email_only_pilot_signup.sql`).
4. **Keep the `public` schema exposed** through the Data API (the default). The route handlers call two RPC functions and insert into `contact_messages` through PostgREST using the secret key.
5. **Verify persistence** (see [Testing → forms](#testing-the-forms)).

### What the migrations create

`20261108120000_inquiries.sql` creates the objects below; `20261109120000_email_only_pilot_signup.sql` makes name and interest area optional for the e-mail-only sign-up and updates `submit_demo_request`. The second migration is backward compatible and can be applied before the new site version is deployed.

| Object                         | Purpose                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo_requests`                | Pilot sign-ups. Only the e-mail address is collected (normalized, ≤ 254 chars). Columns for name, interest area, message and marketing consent remain from the first migration and are optional; their CHECK constraints apply when a value is present. `submission_count`, `last_submitted_at` support deduplication. |
| `contact_messages`             | Contact form messages (message 10–4000 chars).                                                                                                                                                                                                                                                                         |
| `form_rate_limits`             | Fixed-window counters keyed by an HMAC of IP or e-mail.                                                                                                                                                                                                                                                                |
| `submit_demo_request(...)`     | Inserts a sign-up or merges it into one with the same e-mail (and interest area, if any) from the last 24 hours. Returns nothing, so responses never reveal whether an address exists. A later submission never erases a stored name, message or consent.                                                              |
| `consume_form_rate_limit(...)` | Counts one attempt and returns whether it is within the limit; deletes counters older than one day.                                                                                                                                                                                                                    |

**Retention of rate-limit data:** counters are deleted opportunistically on every call once they are older than one day. If forms receive no traffic for long periods, an optional `pg_cron` job can purge them on a schedule:

```sql
select cron.schedule('purge-form-rate-limits', '17 3 * * *',
  $$delete from public.form_rate_limits where window_start < now() - interval '1 day'$$);
```

**Retention of inquiries** is not automated; define it before launch (checklist).

### Reading inquiries

There is no admin UI in this release. Inquiries can be read by the project owner in the Supabase dashboard (Table editor or SQL editor). No e-mail notification is sent when an inquiry arrives.

### Local verification of the migration

`scripts/verify-migrations.sh` creates a throwaway PostgreSQL cluster, emulates Supabase's `anon`, `authenticated` and `service_role` roles **and** Supabase's broad default privileges, applies the migrations and runs `supabase/tests/verify_inquiries.sql`. It checks RLS, revoked privileges, constraints, deduplication, consent handling and rate limiting. It requires PostgreSQL server binaries and is a consistency check, not a substitute for testing against a real Supabase project.

## Security model

- **Server-side writes only.** Browsers never talk to Supabase. Forms POST JSON to Next.js route handlers, which validate and then write with the secret key from a `server-only` module.
- **RLS enabled, no policies.** `anon` and `authenticated` have no row access. Table and function privileges are also revoked from `public`, `anon` and `authenticated`, so browsers cannot bypass the route handlers' anti-abuse controls by calling the Data API directly.
- **Functions** are `SECURITY INVOKER` with an empty `search_path`; only `service_role` may execute them.
- **Request pipeline** (`src/lib/forms/handle-inquiry.ts`): `Content-Type: application/json` → same-origin check (`Origin` must match the request host, `NEXT_PUBLIC_SITE_URL` or `FORM_ALLOWED_ORIGINS`) → 16 KB body cap enforced on the stream → JSON parse → honeypot → Zod validation → storage availability → optional Turnstile verification → durable rate limit (per IP: 5 / 10 min; per e-mail: 3 / hour for pilot requests, 5 / hour for contact) → persistence. Success (`201`) is returned only after the database write succeeds.
- **Honest failures.** Missing configuration → `503 unavailable`; database errors → `500 persistence_failed`; the form keeps the visitor's input and offers a retry. No inquiry is silently discarded.
- **Logging** contains event codes only (e.g. `[inquiry:contact] rate limited: contact:ip`), never names, e-mail addresses or messages.
- **Pseudonymization.** IP and e-mail values used for rate limiting are HMAC-SHA256 hashed before leaving the application.
- **Headers** (`next.config.ts`): `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. A full nonce-based `script-src` CSP is not enabled because it would force every page to render dynamically; it is listed as an optional hardening step.
- **No trackers, no analytics, no cookies** are set by the site. The demo never writes to `localStorage`/`sessionStorage` and makes no network requests for its interactions (verified by an e2e test).
- The honeypot alone is not treated as sufficient protection; it is one layer.
- The client-IP header (`x-forwarded-for`) is trustworthy on Vercel; elsewhere it may be client-controlled and is used only as a rate-limit key.

## Testing

### Commands

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run build
```

```bash
./scripts/verify-migrations.sh
```

Playwright uses the preinstalled Chromium in this development environment. On a new machine, install browsers once with `npx playwright install chromium`.

### What is covered

| Area            | Tests                                                                                                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dates           | Month-end clamping, leap years (29 Feb), month/year transitions, DST-safe differences, Ljubljana calendar date, Slovenian formatting and plural forms (`tests/unit/dates.test.ts`)                                                                                                                                                                  |
| Demo dataset    | Overview counts stable for every reference date over 800 days, referential integrity, everything marked fictional (`demo-dataset.test.ts`)                                                                                                                                                                                                          |
| Demo state      | Create/propose/confirm/close requests, completion recorded separately, invalid dates rejected, reset, filtering (`demo-state.test.ts`)                                                                                                                                                                                                              |
| Recommendations | Explanations, unknown compatibility stays unknown, missing evidence not converted to a match, replacement wording and safety caveat, no scores, commercial relationship has no effect on labels/order, sponsored incompatible product stays incompatible (`recommendations.test.ts`)                                                                |
| Tenders         | Satisfied / not satisfied / evidence missing / human review; missing evidence stays unresolved (`tenders.test.ts`)                                                                                                                                                                                                                                  |
| Forms (server)  | Validation, normalization, unknown fields ignored, 503 without configuration, 500 on persistence failure without PII in logs, honeypot, rate limits with `Retry-After`, hashed identifiers, origin, content type, body size, Turnstile (`inquiry-handler.test.ts`, `validation.test.ts`)                                                            |
| End-to-end      | Navigation to demo, deep links, mobile menu focus behavior, form validation and focus, duplicate-click protection, honest unavailable state, network error retry, contact form, API origin/method checks, demo flows, keyboard tab navigation, drawer focus return, no storage/network use by the demo, no horizontal overflow, `noindex`, 404 page |

### Testing the forms

- **Without Supabase:** submit the form; you should see the "ni na voljo" error and your input preserved.
- **With Supabase:** set the variables in `.env.local`, run `npm run dev`, submit both forms, then confirm the rows in the Supabase Table editor. Submit the same pilot request twice within 24 hours: one row with `submission_count = 2` is expected. Submit more than five requests within ten minutes from the same IP: the sixth returns the "preveč poskusov" message.
- **API directly** (expects `201` with Supabase configured, `503` without):

```bash
curl -i -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d '{"fullName":"Test Oseba","email":"test@example.com","message":"Testno sporočilo za preverjanje."}'
```

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js; Node.js 20 or 22).
2. Set environment variables per environment:
   - **Production:** `NEXT_PUBLIC_SITE_URL` (real domain), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, optional Turnstile keys.
   - **Preview:** either omit Supabase variables (forms show the unavailable state) or point to a separate Supabase project. Previews are always `noindex`.
3. Deploy. The homepage and legal pages are static (revalidated daily); `/demo` is partially prerendered and computes the dataset per request; the API routes run on the Node.js runtime.
4. Add the custom domain in Vercel, then set `NEXT_PUBLIC_SITE_URL` to it and redeploy so canonical URLs, sitemap and robots point to the real domain.

Without `NEXT_PUBLIC_SITE_URL`, Next.js resolves the social image URL against Vercel's deployment domain (`VERCEL_PROJECT_PRODUCTION_URL`, or the preview URL on previews), and against `localhost` in local builds. No canonical URL or sitemap entry is published in that state.

## How the demo data works

- `src/data/demo/` defines a fictional organization ("Vzorčni zdravstveni zavod"), fictional partners ("Servis Sigma", "Distributer Omega"), fictional manufacturers ("Proizvajalec Alfa" …), 12 devices, maintenance plans, service history, service requests, product candidates and three illustrative tenders.
- **Time-relative:** every date is computed from one reference date (`getDemoReferenceDate()` in `src/lib/dates/reference-date.ts`, the current calendar date in `Europe/Ljubljana`). Offsets keep at least five days of distance from status thresholds, so statuses never change with month lengths. A unit test checks this for 800 consecutive reference dates.
- **Date rules:** deadlines are date-only ISO strings computed in UTC. Adding months clamps to the last valid day (31 Jan + 1 month = 28/29 Feb). Interval plans are always computed from the last recorded completion, never chained from a clamped date. Inspection, calibration, preventive maintenance and warranty are separate fields; plans can be interval-based or manually dated, and each carries its source (manufacturer instructions, internal procedure, service contract).
- **Statuses:** overdue (due date before the reference date), upcoming (0–30 days), scheduled (later), no due date.
- **Single source of numbers:** `src/features/demo/selectors.ts` computes all counts; the homepage preview and the demo use the same functions.
- **Interaction state** (`src/features/demo/state.ts`) is a pure reducer held in React state. Nothing is persisted or transmitted. "Ponastavi demo" restores the initial state.
- **Service requests:** proposing a date and confirming it are separate actions; "Termin potrjen" and "V izvedbi" require a confirmed date. Closing a request does **not** mark maintenance as done; completion is a separate action with a completion date and creates a demo service record.

## Recommendation and tender matching

- `src/features/recommendations/rules.ts` and `src/features/tenders/rules.ts` contain small, deterministic, documented rules. No external AI service is called, and the UI states that the results come from rules.
- Recommendations keep five concerns separate: relevance (stated needs, services), compatibility (only from explicit declarations; otherwise **unknown**), documentation, repair-or-replace considerations (age vs. documented service life, repairs and recorded costs over 24 months – phrased as "Smiselna je presoja možnosti popravila ali zamenjave", with an explicit caveat that age or cost does not imply the device is unsafe), and commercial relationship (disclosed, never used for ranking).
- Review labels: "Smiselno za nadaljnji pregled", "Potrebno preverjanje združljivosti", "Premalo podatkov", "Ni združljivo po dokumentaciji". No suitability score or probability is produced.
- Tender requirements resolve to satisfied / not satisfied / evidence missing / human review required. The overall label is only "Primerno za nadaljnji pregled" or "Potreben dodaten pregled" – never an eligibility decision.
- **Adapter:** `src/features/matching/engine.ts` defines an async `MatchingEngine` interface. The demo page calls it on the server and passes serializable results to the client. A future model-assisted engine can implement the same interface (with the same explainable output and mandatory human review) without UI changes.

## Editing Slovenian copy

| What                                                             | Where                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Homepage sections, module cards, partner and pilot texts, footer | `src/data/marketing/home.ts`                                                    |
| FAQ                                                              | `src/data/marketing/faq.ts`                                                     |
| Navigation labels                                                | `src/data/marketing/navigation.ts`                                              |
| Demo labels (statuses, categories, document types)               | `src/features/*/labels.ts`                                                      |
| Demo notices                                                     | `src/data/demo/notices.ts`                                                      |
| Form validation messages                                         | `src/lib/validation/inquiry-schemas.ts`                                         |
| Form error messages                                              | `src/lib/forms/inquiry-response.ts`                                             |
| Recommendation/tender explanation sentences                      | `src/features/recommendations/rules.ts`, `src/features/tenders/rules.ts`        |
| Legal drafts                                                     | `src/app/(marketing)/zasebnost/page.tsx`, `src/app/(marketing)/pogoji/page.tsx` |
| Site name, metadata title/description, contact placeholders      | `src/lib/config/site.ts`                                                        |

Editorial rules: describe demo functionality as demo ("V demonstraciji si oglejte …"), future functionality as planned ("Predvidena funkcionalnost …"), never use "Na voljo" for demo-only modules, prefer "izdelek" over "produkt", and use `pluralSl()` from `src/lib/utils/plural.ts` for counts.

When the privacy notice changes, bump `privacyNoticeVersion` in `src/lib/config/site.ts`; the version is stored with each inquiry.

## Adding a platform module

1. Add an entry to `modules.items` in `src/data/marketing/home.ts` with `title`, `description`, `icon`, `availability` (`interactive_demo`, `in_development` or `planned`) and an optional `demoLink`.
2. If the icon key is new, map it in `src/components/marketing/icons.ts`.
3. If the module gets a demo view: add the view id to `src/features/demo/views.ts`, add its label/icon/description in `viewMeta` in `src/components/demo/demo-workspace.tsx`, and render the view component there.
4. Add or extend e2e tests in `tests/e2e/`.

## Adding products and matching rules

- **Products:** add a `Product` to `src/data/demo/catalog.ts` (use fictional names in the public demo) with `documentIds`, `intendedUse` (with a source document), explicit `compatibility` declarations, `verificationStatus`, `marketAvailability`, `supportedServiceCategories` and `commercialRelationship`. Add document metadata entries for every referenced document.
- **Candidates:** pair a product with the organization's context in `src/data/demo/recommendations.ts` (related equipment, needs, services and the models that must be compatible).
- **Rules:** extend `evaluateRecommendation()` / `evaluateRequirement()`. Keep the invariants covered by the tests: unknown stays unknown, missing evidence is listed, commercial relationship never affects labels or ordering, no scores.
- **Future product data** (`Product` in `src/types/domain.ts`) already carries source documentation, verification status, intended use, compatibility and market availability. Equipment can reference a product that is not part of any operator catalog.

## Launch checklist

| Item                                                                         | Status                                                                  | Where / action                                                                                                           |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Real domain                                                                  | Missing                                                                 | Configure in Vercel; set `NEXT_PUBLIC_SITE_URL`                                                                          |
| Legal operator details (name, address, registration number, privacy contact) | Missing                                                                 | `siteConfig.legalOperator`; then review `/zasebnost` and `/pogoji`                                                       |
| Public contact details (e-mail, phone, address)                              | Missing (hidden until set)                                              | `siteConfig.contact`                                                                                                     |
| Optional Medcore link                                                        | Not set                                                                 | `siteConfig.medcoreUrl`                                                                                                  |
| Social links                                                                 | Not set                                                                 | `siteConfig.social`                                                                                                      |
| Privacy notice and terms approved by the operator / legal counsel            | Drafts only                                                             | Remove the draft banner and `noindex` from both pages after approval; add them to `sitemap.ts` if they should be indexed |
| Legal basis, retention period and processor contracts (Vercel, Supabase)     | Missing                                                                 | Privacy notice sections 4–6                                                                                              |
| Database region and hosting region                                           | Not decided                                                             | Supabase project settings; Vercel function region; document in privacy notice                                            |
| Inquiry retention and deletion procedure                                     | Not defined                                                             | Define; optionally automate with a scheduled SQL job                                                                     |
| Rate-limit retention                                                         | Implemented (≈24 h, opportunistic)                                      | Optional `pg_cron` job (see above)                                                                                       |
| Anti-abuse configuration                                                     | Honeypot, origin, body cap, validation, durable rate limits implemented | Decide whether to enable Turnstile; if enabled, document it in the privacy notice                                        |
| Verified form persistence                                                    | Not verified against a live project (no credentials available)          | Apply migration, set env vars, submit both forms, confirm rows                                                           |
| Production environment variables                                             | Not set                                                                 | Vercel → Production                                                                                                      |
| Inquiry notification (e-mail)                                                | Not implemented                                                         | Optional integration; do not claim notifications until implemented and tested                                            |
| Response-time promise                                                        | None shown                                                              | `siteConfig.inquiryResponseTimeText` if one is agreed                                                                    |
| Optional nonce-based CSP                                                     | Not enabled                                                             | Consider via `proxy.ts` if dynamic rendering is acceptable                                                               |

## Known limitations

- Form persistence was tested with mocked repositories (unit), against a local PostgreSQL with emulated Supabase roles (`verify-migrations.sh`) and in the browser for the unconfigured state. It was **not** tested against a live Supabase project because no credentials were available.
- Turnstile verification is implemented and unit-tested with a mocked response, but not tested against Cloudflare.
- Accessibility follows WCAG 2.2 AA practices (semantic structure, labels, focus management, keyboard support, non-colour status indicators, reduced motion), verified by automated checks and manual review of rendered pages. No formal conformance audit or screen-reader test session has been performed, so no conformance claim is made.
- The demo is desktop-first in density; on phones it switches to cards and a scrollable tab strip.
- `npm audit` reports moderate advisories in development-only tooling (transitive `minimatch` via `typescript-eslint`); they do not affect the production bundle.
- When the homepage is cached, its preview may be up to one day behind the current date (relative statuses are unaffected).

## Future authenticated application

The path from this demonstration to a product is documented here; none of it is implemented.

### Access model

| Role                           | Intended access                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Organization administrator     | Manages members, roles, partner access grants and organization settings                                        |
| Equipment manager              | Maintains equipment, plans, documents and service requests for the organization                                |
| Authorized service partner     | Sees only equipment and requests explicitly assigned to it, for the assigned purpose (e.g. performing service) |
| Distributor with scoped access | Sees only data the organization has explicitly shared for a defined purpose and period; no general visibility  |

An `organizationId` column alone does **not** provide tenant isolation. Isolation requires Supabase Auth, membership tables and RLS policies bound to verified membership (`auth.uid()`), plus server-side checks for every privileged operation.

### Architecture steps

1. **Auth and organizations:** Supabase Auth, `organizations`, `memberships` (role), invitations with expiring tokens; RLS on every organization-scoped table.
2. **Equipment register:** persist the domain models in `src/types/domain.ts` with `organization_id`; repository interfaces in `src/lib/repositories/` get Supabase implementations; import from spreadsheets.
3. **Partner assignments:** `access_grants` (grantee organization, scope, purpose, validity); service delivery separated from commercial prospecting; no cross-organization access by default.
4. **Private documents:** Supabase Storage private buckets, signed URLs, metadata in tables, virus scanning, retention.
5. **Audit history:** append-only `audit_events` for service-event changes, access grants and exports.
6. **Reminders:** separate due-date calculation (pure functions already in `src/features/equipment/maintenance.ts`) from delivery; a scheduled job writes `notification_jobs`, a worker delivers with retries and idempotency keys, delivery history is stored, time zone `Europe/Ljubljana`. An in-app notice is never presented as a sent e-mail.
7. **Product data:** manufacturer/distributor relationships, document verification workflow, verification status shown to users.
8. **Explainable matching:** keep `MatchingEngine`; any model-assisted engine must return the same explanation structure, cite sources, keep unknowns unknown and require human review.
9. **Procurement sources:** an adapter interface per source (not a fake connector); store source URL, retrieval date, notice and attachment references and versions; handle changed notices; review each source's terms of use before ingesting (an openly published source does not automatically permit unrestricted scraping or reuse); a person confirms any eligibility conclusion; no unattended bid submission.
10. **Data rights:** export, retention and deletion procedures; processor contracts and provider review; controls against sharing confidential data across organizations.

### Privacy requirements for the future application (not yet implemented)

Organization-level access control · explicit partner-sharing permissions · separation of service delivery and commercial prospecting · audit history · data export · retention and deletion procedures · private document storage · contracts and provider review · controls against cross-organization sharing · human review of product and tender recommendations.
