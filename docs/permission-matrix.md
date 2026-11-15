# Permission matrix

Roles are per organization (`organization_memberships.role`). External technicians are not members: they hold
request-scoped assignments (`service_assignments`) created through invitations.

Every rule is enforced in three places:

1. **UI** — `src/lib/auth/permissions.ts` (`permissionMatrix`, `can()`) decides what is shown.
2. **Server Actions / Route Handlers** — `requireOrgPermission()` re-reads the membership for every request.
3. **Database** — RLS policies, column privileges, triggers and SECURITY DEFINER functions with explicit actor
   checks. The database rule is authoritative; hidden buttons are never the only protection.

Legend: ✔ allowed · — not allowed · (own) only own records

## Organization roles

| Capability                                                                                              |         Owner          |      Admin      | Equipment manager | Viewer  | Enforced in the database by                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | :--------------------: | :-------------: | :---------------: | :-----: | --------------------------------------------------------------------------------------------------------------------------- |
| View organization data (equipment, plans, requests, documents, notifications of own account, audit log) |           ✔            |        ✔        |         ✔         |    ✔    | `is_org_member` in select policies                                                                                          |
| Rename organization, completion-acknowledgment rule, reminder recipients                                |           ✔            |        —        |         —         |    —    | `organizations_update_owner` policy, column grants                                                                          |
| Invite members                                                                                          |      ✔ (any role)      | ✔ (up to admin) |         —         |    —    | `invitations_insert` policy, `TM_INVITATION_ROLE_TOO_HIGH` trigger                                                          |
| Change roles / remove members                                                                           |           ✔            | ✔ (not owners)  |         —         |    —    | `memberships_update/delete` policies, `enforce_membership_change` trigger (no self-change, last owner kept)                 |
| Leave the organization                                                                                  | ✔ (not the last owner) |        ✔        |         ✔         |    ✔    | `memberships_delete` policy, `TM_LAST_OWNER`                                                                                |
| Equipment, locations: create, edit, archive                                                             |           ✔            |        ✔        |         ✔         |    —    | `equipment_*`, `locations_*` policies; no delete privilege                                                                  |
| CSV import / export                                                                                     |           ✔            |        ✔        |         ✔         |    —    | `import_equipment` checks the role; export route checks `equipment.export`                                                  |
| Maintenance plans: create, edit, archive                                                                |           ✔            |        ✔        |         ✔         |    —    | `maintenance_plans_*` policies; derived dates not writable                                                                  |
| Service requests: create, edit title / description / priority                                           |           ✔            |        ✔        |         ✔         |    —    | `service_requests_insert/update` policies, column grants                                                                    |
| Coordinate a request (status steps, appointments, replacement equipment, shared and internal messages)  |           ✔            |        ✔        |         ✔         |    —    | `transition_service_request`, `propose_appointment`, `respond_appointment`, `set_replacement_status`, message insert policy |
| Close or cancel a request                                                                               |           ✔            |        ✔        |         ✔         |    —    | `transition_service_request` (operators only; reason required for cancelling)                                               |
| Assign external technicians (invitation), revoke access                                                 |           ✔            |        ✔        |         —         |    —    | `invitations_insert` policy, `service_assignments_revoke` policy                                                            |
| Record a completion                                                                                     |           ✔            |        ✔        |         ✔         |    —    | `record_completion`                                                                                                         |
| Acknowledge or reject an external completion                                                            |           ✔            |        ✔        |         ✔         |    —    | `acknowledge_completion`                                                                                                    |
| Void a completion record                                                                                |           ✔            |        ✔        |         —         |    —    | `void_completion` (reason required; the record is kept)                                                                     |
| Upload documents, share request documents with technicians, archive documents                           |           ✔            |        ✔        |         ✔         |    —    | `create_pending_document`, `documents_update` policy                                                                        |
| Download documents                                                                                      |           ✔            |        ✔        |         ✔         |    ✔    | `documents_select` policy + storage policy; 60-second signed URL                                                            |
| Private catalog notes, recommendation feedback, supplier inquiries                                      |           ✔            |        ✔        |         ✔         |    —    | `catalog_private_notes_*`, `recommendation_feedback_*`, `supplier_inquiries_insert` policies                                |
| Publish catalog products (approved supplier organizations only)                                         |           ✔            |        ✔        |         —         |    —    | `can_publish_catalog` (role + `supplier_approvals` + organization kind)                                                     |
| Answer supplier inquiries (supplier side)                                                               |           ✔            |        ✔        |         —         |    —    | `supplier_inquiries_update` policy + trigger                                                                                |
| Own notification preferences                                                                            |        ✔ (own)         |     ✔ (own)     |      ✔ (own)      | ✔ (own) | `notification_preferences_*` policies                                                                                       |

## External technician (request-scoped assignment)

| Capability                                                                                                              | Allowed | Enforced by                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | :-----: | ------------------------------------------------------------------------------------------- |
| See the assigned request, its shared messages, appointment proposals, completion records, shared documents and timeline |    ✔    | `can_view_request` in select policies                                                       |
| See a reduced equipment header (name, category, manufacturer, model, serial number, location) and the organization name |    ✔    | `service_request_brief`, `my_service_assignments` (definer, filtered to active assignments) |
| See the organization's equipment register, members, audit log, internal messages, internal documents, other requests    |    —    | no select policy matches                                                                    |
| Propose appointments, accept appointments proposed by the organization                                                  |    ✔    | `propose_appointment`, `respond_appointment`                                                |
| Start work (`termin_potrjen → v_izvedbi`), return to scheduling                                                         |    ✔    | `transition_service_request`                                                                |
| Record a completion (pending acknowledgment when the organization requires it)                                          |    ✔    | `record_completion`                                                                         |
| Post shared messages, upload documents (always shared with the organization)                                            |    ✔    | message insert policy, `create_pending_document`                                            |
| Change replacement-equipment state                                                                                      |    ✔    | `set_replacement_status`                                                                    |
| Close or cancel the request, acknowledge or void completions, invite others                                             |    —    | function checks                                                                             |

Access ends immediately when the assignment is revoked; queued e-mails to a revoked technician are cancelled
by `claim_outbox`.

## Platform operator (Tender Med d.o.o.)

The operator has no in-app role. Operator tasks run with the service role and are not reachable from the web
application:

- `scripts/bootstrap-organization.mjs` (or the SQL in `docs/pilot-runbook.md`) — create an organization and the
  first owner invitation;
- `scripts/approve-supplier.mjs` — approve or suspend a supplier and record the declared commercial
  relationship;
- `/api/cron/notifications` — daily job, authorized by `CRON_SECRET`.
