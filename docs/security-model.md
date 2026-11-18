# Security model

Scope: the invitation-only platform under `/app` (pilot). The public website's form pipeline is described in
the README.

## Identity and sessions

- Supabase Auth with SSR cookies (`@supabase/ssr`). Identity is read with `auth.getClaims()`, which verifies
  the JWT signature; unverified session data is never trusted.
- `src/proxy.ts` only refreshes the session cookie; it is not an authorization layer. Every page, Server Action
  and Route Handler authorizes itself (`requireUser`, `getOrgContext`, `requireOrgPermission`), because
  layouts and pages render independently.
- Login is rate limited per IP (20 / 10 min) and per e-mail (8 / 10 min) in the durable `form_rate_limits`
  table; failures return one generic message. Password reset always answers neutrally.
- Post-login redirects accept only `/app`, `/app/*`, `/povabilo/*` and `/ponastavitev-gesla` (`safeNextPath`).
- Platform pages and auth pages send `Cache-Control: private, no-store` and `noindex`; `robots.txt` disallows them.

## Onboarding and invitations

- There is no public sign-up in the application. The first owner of each organization is invited by the
  operator; further users are invited by owners and admins.
- Tokens: 32 random bytes, base64url; only the SHA-256 hash is stored. Single use, 7-day expiry (at most 30),
  revocable, one pending invitation per e-mail, organization and request.
- `accept_invitation` locks the row (`FOR UPDATE`), checks revocation, use, expiry, that the caller's account
  e-mail equals the invited e-mail and that the e-mail is confirmed.
- **Pilot limitation (no e-mail domain):** invitation links are shown once to the inviter, who delivers them.
  When the invitee has no account, the account is created with `email_confirm: true` by the server
  (`auth.admin.createUser`). Possession of the link is therefore the proof of e-mail ownership. Deliver links
  only through a channel you trust, and revoke any link that may have been exposed. Once a sending domain is
  configured, invitation e-mails should replace manual delivery.
- Recommended Supabase setting: disable "Allow new users to sign up" (the application does not need it;
  server-side account creation still works). Without this, anyone can create an empty account through the Auth
  API; such an account has no membership and sees no data, but disabling sign-ups removes the noise.

## Tenant isolation

- Every table in `public` has RLS enabled (verified by `tests/db/security.test.ts`).
- Organization-scoped rows carry `organization_id`; child rows reference parents through composite foreign keys
  `(organization_id, id)`, so a row can never point to another organization's equipment, plan, request,
  document or product. `organization_id` is immutable (`TM_ORGANIZATION_IMMUTABLE`).
- Access helpers (`private.is_org_member`, `has_org_role`, `can_view_request`, …) are SECURITY DEFINER
  functions in the non-exposed `private` schema with `search_path = ''`; they read memberships without
  recursive RLS.
- Trigger rules that restrict clients apply when `current_user = 'authenticated'`, which a client cannot fake;
  trusted paths (definer functions, the service role) are exempt where intended. The last-owner rule always
  applies.
- State changes that need several checks (service status, appointments, completions, voiding, replacement
  equipment, pending documents, product saves) run in database functions that lock rows and check the actor
  explicitly. Clients have no write privilege on the columns those functions manage.
- Optimistic concurrency: `version` columns; updates match on the expected version and report conflicts.
- The cross-organization sweep test populates one organization through its own users and checks, for every
  table with `organization_id`, that members of another organization see zero rows and that the anonymous role
  is refused.

## External technicians

Request-scoped assignments give access to one request: its shared messages, proposals, completions, shared
documents and timeline, plus a reduced equipment header through `service_request_brief`. They never see the
organization's register, members, audit log, internal messages or internal documents. Revocation takes effect
on the next request; pending e-mails are cancelled at send time.

## Documents

- Private bucket `documents`; object path fixed to `<organization_id>/<document_id>` by a check constraint.
- Upload: the server authorizes and creates a `pending` row, then issues a signed upload URL for that exact
  path. After the browser upload, the server downloads the object with the service role and verifies the size
  and the format signature (magic bytes) against the declared type; mismatches are deleted and rejected.
  Accepted types: PDF, JPEG, PNG, WebP, DOCX, XLSX; maximum 20 MB. File names are sanitized for display.
- Download: `/app/dokumenti/[id]` reads the row through RLS and redirects to a signed URL valid for 60 seconds
  with `Content-Disposition: attachment`.
- Storage RLS allows authenticated reads only for objects whose document row is `ready` and readable for the
  caller; there are no client insert, update or delete policies.
- Abandoned uploads (pending for more than a day) are marked rejected and their objects removed by the daily job.
- No malware scanning is performed (not available in this setup). Documents are downloaded, never rendered
  inline by the application.

## Notifications and e-mail

- Notifications are created only by the database (triggers and the reminder function) with a unique event key
  per recipient, so retries never duplicate them.
- E-mails contain the title, a short body and a link — never message contents, documents or equipment notes.
- `email_outbox` is service-role only. `claim_outbox` uses `FOR UPDATE SKIP LOCKED`, re-checks that the
  recipient still has access, still wants e-mail and has a confirmed address, and cancels the rest. Every row
  has an idempotency key sent to the provider; a crash between sending and recording is retried with the same
  key within 23 hours, older ambiguous rows are marked `unknown` and never resent automatically. Retries use
  exponential backoff with at most five attempts; pending rows expire after seven days.
- `/api/cron/notifications` requires `Authorization: Bearer $CRON_SECRET` (timing-safe comparison) and returns
  `503` when the secret is not configured.

## Catalog and recommendations

- Only organizations approved by the operator (`supplier_approvals`, service role only) can publish. Suspension
  hides their products immediately.
- Every product shows the supplier's declared commercial relationship with the operator. Recommendation
  ordering is computed from the organization's data by fixed rules and never uses the relationship.
- Supplier inquiries carry an explicit snapshot chosen by the sender (organization name, optional contact,
  selected equipment fields). Suppliers never query the requesting organization's data.
- Catalog source links must use `https://` and open with `rel="noopener noreferrer nofollow"`.

## CSV

- Import: fixed columns, at most 500 rows and 1 MB, UTF-8 or Windows-1250, validation of every row before
  anything is written, then one transactional database call (all rows or none).
- Export: cells starting with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with an apostrophe
  (CSV/formula injection). The import reverses this for files exported by the platform.

## Audit

`audit_events` records who changed what (table, row, action, changed column names) for organizations,
memberships, invitations, equipment, locations, plans, requests, assignments, completions, documents, catalog
products and supplier inquiries. Values are not stored, so confidential text never enters the audit log.
Clients cannot write or change audit rows.

## Secrets and configuration

- Privileged values are read only in `src/lib/config/server-env.ts` (`server-only`). The publishable key is
  public by design; the secret key, `CRON_SECRET` and `RESEND_API_KEY` must never be exposed.
- The owner decided to keep the current Supabase secret key during the test phase although it was shown in a
  screenshot earlier. Rotate it before real customer data is entered (Supabase → Project Settings → API Keys →
  create a new secret key, update `SUPABASE_SECRET_KEY` in Vercel, redeploy, then revoke the old key).
- Preview deployments should not point to the production Supabase project with production data. In the pilot
  the website and the platform share one project (owner's decision); keep Preview environment variables empty
  or point them to a separate project.

## Known limitations

- The HTTP layer (PostgREST, Supabase Auth, Storage) was not exercised in the development environment: Docker
  images could not be downloaded and running a PostgREST binary was not permitted. The database rules are tested
  directly in PostgreSQL 16 with an emulation of Supabase's roles, `auth` and `storage` schemas. End-to-end tests
  cover only unauthenticated paths. Authenticated journeys must be checked manually on the real project
  (`docs/pilot-runbook.md`, acceptance checklist).
- Password recovery e-mails use Supabase's built-in e-mail service, which is rate limited and intended for
  testing; configure custom SMTP before relying on it.
- No full nonce-based Content-Security-Policy for scripts (see README).
- No malware scanning of uploaded documents.
- The platform is not intended for patient data. Do not enter personal health information in equipment notes,
  messages or documents.
