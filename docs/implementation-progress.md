# Implementation progress

Updated at the end of every phase. Status values: **implemented and tested**, **implemented, awaiting
configuration**, **partially implemented**, **planned**.

## Phase 0 — Baseline (done)

- Branch restarted from `origin/main` (PR #1 merged).
- Baseline on `main` (`461e1b6`): lint, typecheck, Prettier, 72 unit tests, migration verification,
  51 e2e tests (15 viewport-specific skips), production build, `npm audit --omit=dev` (0) — all passed.
- Local Supabase (Docker) is not available in the build environment (image downloads blocked). Database and
  RLS tests run on a throwaway PostgreSQL 16 cluster with an emulation of the Supabase `auth`/`storage`
  schemas and the real `anon`/`authenticated`/`service_role` roles (`npm run test:db`).
- Added dependencies: `@supabase/ssr` (runtime), `pg` + `@types/pg` (tests).

## Phase 1 — Foundation (done, commit `d02db7a`)

| Module | Status |
| --- | --- |
| Login, logout, password recovery (`/prijava`, `/pozabljeno-geslo`, `/ponastavitev-gesla`, `/auth/callback`) | implemented, awaiting configuration (needs Supabase Auth redirect URLs; recovery e-mail uses Supabase default SMTP) |
| Invitation-only onboarding (`/povabilo/[token]`, accept / create account) | implemented and tested (database); UI flow needs a configured project |
| Organizations, memberships, roles, last-owner rule | implemented and tested (database) |
| Operator bootstrap (`scripts/bootstrap-organization.mjs`) | implemented and tested (database function) |
| Settings: organization, members, invitations (copy-once link) | implemented; UI needs a configured project |
| Audit trigger (changed column names only) | implemented and tested |

Tests after Phase 1: 92 unit, 27 database, 51 e2e (15 skips).

## Phase 2 — Equipment (done)

Migration `20261110120100_equipment.sql`:

- `locations`, `equipment`, `maintenance_plans` with composite organization-consistent foreign keys
  (`(organization_id, id)`), immutable `organization_id`, optimistic-concurrency `version`, server-set
  authorship, no delete privilege (archive instead), audit triggers.
- `private.compute_next_due()` for the three scheduling modes; `next_due_date` / `last_completed_on` are
  derived by a trigger and not writable by clients. `private.plan_completion_dates()` returns no dates until
  completion records exist (Phase 3).
- Views `equipment_overview` and `maintenance_agenda` (`security_invoker`, RLS of the base tables applies).
- `import_equipment(org, rows)`: all-or-nothing import, at most 500 rows, creates missing locations.

| Module | Status |
| --- | --- |
| Equipment register: list with search, filters, pagination; create, edit (version check), archive / restore | implemented; database rules tested; UI needs a configured project |
| Locations (create from equipment form or settings, rename, archive / restore) | implemented; database rules tested |
| Maintenance plans (fixed_calendar, after_completion, one_off; source basis; reminder days; responsible person) | implemented and tested (TypeScript and SQL scheduling parity, 12 shared cases) |
| Calendar (`/koledar`, 30 / 90 / 365 days, overdue first) | implemented; view tested in the database |
| Overview with real counts (equipment, overdue, due in 30 days, unavailable, without open due date) | implemented; queries not yet run against PostgREST |
| CSV import (fixed format, preview, row errors, ≤ 500 rows / 1 MB, UTF-8 or Windows-1250, all-or-nothing) | implemented and tested (parser, validation, database function) |
| CSV export (formula-injection neutralized, round-trips through the import) | implemented and tested (unit) |
| Equipment change history (audit events on the detail page) | implemented; audit trigger tested |

Not verifiable in this environment: PostgREST query behaviour of the repository functions
(`src/lib/repositories/equipment.ts`) — the database is tested directly with SQL under RLS, but the HTTP
layer needs a real Supabase project (running a local PostgREST binary was not permitted here).

Tests after Phase 2: 121 unit, 41 database, 71 e2e (15 viewport skips).
