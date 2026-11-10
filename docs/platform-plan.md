# Platform plan (approved 2026-11-10)

Scope and decisions approved by the product owner. Communication with the owner is in Slovenian; this
internal document is in English.

## Decisions

| Topic             | Decision                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database          | Same Supabase project as the public website (`tendermed-web`). Migrations are additive; applying them requires the owner's explicit authorization each time.                  |
| Hosting           | Same Vercel project and domain (`platforma-tender-med-inteligence.vercel.app`); the application lives under `/app`.                                                           |
| Vercel plan       | Hobby → one scheduled run per day; operational e-mails are attempted right after the triggering action (`after()`), the daily run reconciles reminders and retries.           |
| E-mail            | No custom domain yet. The Resend adapter is implemented but stays **unconfigured**; in-app notifications work; invitation links are shown to the inviter to deliver manually. |
| Platform operator | Tender Med d.o.o. Not a catalog supplier in the pilot (default); the model supports an operator-distributed disclosure.                                                       |
| Supabase key      | The owner keeps the current secret key during the test phase (noted risk).                                                                                                    |

## First-release scope (implemented as real functionality)

1. Authentication and account recovery (Supabase Auth, SSR cookies)
2. Invitation-only onboarding (hashed single-use tokens, bootstrap command for the first owner)
3. Organizations and memberships (multi-organization)
4. Role-based access (`owner`, `admin`, `equipment_manager`, `viewer`) + request-scoped external assignments
5. Equipment register (archive instead of delete)
6. Maintenance plans (fixed calendar, after completion, one-off)
7. Service requests and coordination (proposals, confirmation, shared/internal messages, replacement equipment states)
8. Service history (completion records with acknowledgment and voiding)
9. Private documents (private bucket, signed URLs, request-scoped sharing)
10. In-app notifications
11. Scheduled e-mail reminders (outbox; delivery requires e-mail configuration)
12. Manually managed product catalog (approved suppliers only)
13. Explainable deterministic recommendations
14. Equipment CSV import (fixed format, transactional, ≤ 500 rows / 1 MB) and export (formula-safe)
15. Audit records for important changes
16. Organization and notification settings

Simplifications agreed in the plan: agenda-style calendar (no drag & drop), one cost amount per completion
record, notification preferences per category (e-mail on/off), recommendations computed on demand (feedback
persisted).

Out of scope: public self-registration, billing, tender scraping, automatic manufacturer discovery, AI agents,
bid preparation, marketplace, rental payments, IoT, failure prediction, clinical decision support, patient
records, general chatbot. The tender demo stays only on `/demo`.
