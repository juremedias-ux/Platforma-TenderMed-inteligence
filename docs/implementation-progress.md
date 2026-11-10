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

| Module                                                                                                      | Status                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Login, logout, password recovery (`/prijava`, `/pozabljeno-geslo`, `/ponastavitev-gesla`, `/auth/callback`) | implemented, awaiting configuration (needs Supabase Auth redirect URLs; recovery e-mail uses Supabase default SMTP) |
| Invitation-only onboarding (`/povabilo/[token]`, accept / create account)                                   | implemented and tested (database); UI flow needs a configured project                                               |
| Organizations, memberships, roles, last-owner rule                                                          | implemented and tested (database)                                                                                   |
| Operator bootstrap (`scripts/bootstrap-organization.mjs`)                                                   | implemented and tested (database function)                                                                          |
| Settings: organization, members, invitations (copy-once link)                                               | implemented; UI needs a configured project                                                                          |
| Audit trigger (changed column names only)                                                                   | implemented and tested                                                                                              |

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

| Module                                                                                                         | Status                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Equipment register: list with search, filters, pagination; create, edit (version check), archive / restore     | implemented; database rules tested; UI needs a configured project              |
| Locations (create from equipment form or settings, rename, archive / restore)                                  | implemented; database rules tested                                             |
| Maintenance plans (fixed_calendar, after_completion, one_off; source basis; reminder days; responsible person) | implemented and tested (TypeScript and SQL scheduling parity, 12 shared cases) |
| Calendar (`/koledar`, 30 / 90 / 365 days, overdue first)                                                       | implemented; view tested in the database                                       |
| Overview with real counts (equipment, overdue, due in 30 days, unavailable, without open due date)             | implemented; queries not yet run against PostgREST                             |
| CSV import (fixed format, preview, row errors, ≤ 500 rows / 1 MB, UTF-8 or Windows-1250, all-or-nothing)       | implemented and tested (parser, validation, database function)                 |
| CSV export (formula-injection neutralized, round-trips through the import)                                     | implemented and tested (unit)                                                  |
| Equipment change history (audit events on the detail page)                                                     | implemented; audit trigger tested                                              |

Not verifiable in this environment: PostgREST query behaviour of the repository functions
(`src/lib/repositories/equipment.ts`) — the database is tested directly with SQL under RLS, but the HTTP
layer needs a real Supabase project (running a local PostgREST binary was not permitted here).

Tests after Phase 2: 121 unit, 41 database, 71 e2e (15 viewport skips).

## Phase 3 — Service collaboration (done)

Migration `20261110120200_service_collaboration.sql`:

- `service_requests` (per-organization reference numbers, composite foreign keys to equipment and plans,
  plan must belong to the equipment), `service_assignments` (request-scoped external collaborators),
  `appointment_proposals`, `service_messages` (shared / internal), `completion_records`
  (acknowledgment, voiding, `replaces_id` correction chain), `service_events` (shared timeline).
- All state changes run through definer functions with explicit actor checks and row locks:
  `transition_service_request`, `propose_appointment`, `respond_appointment`, `record_completion`,
  `acknowledge_completion`, `void_completion`, `set_replacement_status`. Clients have no write privilege on
  status, schedule, replacement or completion columns.
- Assignment invitations (`kind = service_assignment`) are accepted through `accept_invitation`; the Phase 1
  placeholder `private.accept_service_assignment` is replaced.
- Assignees read only their requests, the request's shared messages, proposals, completion records and
  timeline, plus a reduced equipment header (`service_request_brief`, `my_service_assignments`); they cannot
  read the organization's equipment, members, audit log or internal messages.
- Plan due dates use only non-voided, acknowledged (or acknowledgment-free) completions with an outcome other
  than "not completed".

| Module                                                                                    | Status                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Service requests: list, filters, create (from list or equipment), edit with version check | implemented; database rules tested; UI needs a configured project |
| Status flow novo → … → zakljuceno / preklicano with role rules                            | implemented and tested (database)                                 |
| External technicians via invitation, revocation, technician area `/app/servisne-naloge`   | implemented and tested (database)                                 |
| Appointment proposals and confirmation (Ljubljana time, DST gaps rejected)                | implemented and tested (database, unit)                           |
| Shared and internal messages                                                              | implemented and tested (database)                                 |
| Completion records: acknowledgment, rejection, voiding, correction, plan recompute        | implemented and tested (database)                                 |
| Replacement equipment states                                                              | implemented and tested (database)                                 |
| Service history on the equipment page, shared timeline, overview counts                   | implemented; queries not yet run against PostgREST                |

Tests after Phase 3: 129 unit, 56 database, 79 e2e (15 viewport skips).

## Phase 4 — Documents (done)

Migration `20261110120300_documents.sql`:

- Private bucket `documents` (20 MB limit, PDF / JPEG / PNG / WebP / DOCX / XLSX); fixed object path
  `<organization_id>/<document_id>`, enforced by a check constraint.
- `documents` table with `pending → ready | rejected` lifecycle, optional equipment or service-request
  scope, `shared_with_assignees` (request documents only), metadata edits only on ready documents,
  no client deletes, audit trigger. `maintenance_plans.source_document_id` now references documents within the
  same organization.
- `create_pending_document` (members with document rights, or the request's assignee — assignee uploads are
  always shared), `finalize_document` and `expire_pending_documents` (service role only).
- Storage RLS: authenticated users can read an object only when its document row is `ready` and readable
  for them; no client insert, update or delete policies.

App:

- Upload: server action creates the pending row and a signed upload URL; the browser uploads with progress
  (XMLHttpRequest); the server downloads the object with the service role, checks size and magic bytes, then
  finalizes or deletes it.
- Download: `/app/dokumenti/[id]` checks the row through RLS and redirects to a 60-second signed URL.
- Documents on the equipment page and on service requests (members and assignees), sharing toggle and
  archiving for operators. `cleanupAbandonedUploads()` removes objects of uploads pending for more than a day
  (scheduled in Phase 5).

| Module                                                      | Status                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document records, access rules, storage RLS, pending expiry | implemented and tested (database, storage schema emulated)                                                                                                    |
| File type and signature checks, file name sanitizing        | implemented and tested (unit)                                                                                                                                 |
| Browser upload with progress, verification, signed download | implemented, awaiting configuration (needs the bucket created by the migration and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; not run against real Storage here) |

Tests after Phase 4: 133 unit, 63 database, 81 e2e (15 viewport skips).

## Phase 5 — Notifications (done)

Migration `20261110120400_notifications.sql`:

- `notifications` (in-app, unique event key per recipient), `notification_preferences` (per user: e-mail
  reminders, e-mail service updates), `email_outbox` (service role only; unique per recipient and event key,
  idempotency key per row), `organizations.reminder_audience`.
- Database triggers create service-update notifications for the other side of a request (never the actor):
  appointment proposals and decisions, completions, acknowledgments, cancellation and closing, shared messages
  (without message text), new assignments, accepted technician invitations.
- `generate_due_reminders(today)`: smallest reached lead time per due date (missed runs catch up without
  duplicates), weekly reminders for overdue items; recipients follow `reminder_audience`.
- `claim_outbox` (SKIP LOCKED, access and preference re-check, stale `sending` rows retried within 23 hours
  with the same idempotency key, otherwise `unknown`), `complete_outbox` (exponential backoff, at most 5
  attempts).

App:

- `/app/[org]/obvestila` (list, mark as read, e-mail preferences), unread badge in the navigation, new
  notifications on `/app/servisne-naloge`, reminder recipients in organization settings.
- Resend adapter with `Idempotency-Key`; used only when `RESEND_API_KEY` and `EMAIL_FROM` are set. E-mails
  contain the title, a short body and a link — never message contents or document data.
- `/api/cron/notifications` (Bearer `CRON_SECRET`, timing-safe comparison): reminders, e-mail sending,
  removal of abandoned uploads. `vercel.json` schedules it daily at 05:17 UTC (Hobby plan: once per day).
- Server actions send queued e-mails right after the response with `after()`.

| Module                                                                          | Status                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| In-app notifications, preferences, reminder generation, service-update triggers | implemented and tested (database)                                                      |
| Outbox claiming, retries, ambiguous outcomes, access re-check                   | implemented and tested (database)                                                      |
| Resend adapter, e-mail rendering, cron authorization                            | implemented and tested (unit); awaiting configuration (no verified sending domain yet) |
| Daily schedule on Vercel                                                        | implemented, awaiting configuration (`CRON_SECRET` in Vercel)                          |

Tests after Phase 5: 137 unit, 71 database, 85 e2e (15 viewport skips).
