import { afterAll, describe, expect, it } from "vitest";
import { admin, asAnon, asService, asUser, createAuthUser, createTenant, newToken, pool, rejection } from "./helpers";

afterAll(async () => {
  await pool.end();
});

/**
 * Database-wide security sweep: structural checks over the catalog plus a
 * cross-organization read test over every table that carries an
 * organization_id, and an end-to-end pilot journey.
 */

describe("structural checks", () => {
  it("enables row-level security on every table in the public schema", async () => {
    const { rows } = await admin<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("pins search_path on every security definer function", async () => {
    const { rows } = await admin<{ name: string }>(
      `select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosecdef and n.nspname in ('public', 'private')
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows).toEqual([]);
  });

  it("gives the anonymous role no table access and only the invitation preview function", async () => {
    const functions = await admin<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`,
    );
    expect(functions.rows.map((r) => r.proname)).toEqual(["get_invitation_preview"]);
    const tables = await admin(
      "select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
    );
    expect(tables.rows).toEqual([]);
    const schema = await admin<{ ok: boolean }>("select has_schema_privilege('anon', 'private', 'usage') as ok");
    expect(schema.rows[0]!.ok).toBe(false);
  });

  it("keeps service-role-only functions away from signed-in users", async () => {
    const user = await createAuthUser();
    for (const call of [
      "select public.generate_due_reminders(current_date)",
      "select * from public.claim_outbox(1)",
      "select public.finalize_document(gen_random_uuid(), true)",
      "select * from public.expire_pending_documents()",
      "select * from public.bootstrap_organization('X', 'healthcare_provider', 'x@example.test', '\\x00')",
    ]) {
      expect(await rejection(asUser(user.id, (q) => q(call)))).toMatch(/permission denied/);
    }
  });
});

describe("cross-organization isolation", () => {
  it("shows a member of one organization no rows of another organization in any table", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const technician = await createAuthUser();
    // Populate organization B through its own users (all triggers run).
    const equipment = await asUser(b.manager.id, (q) =>
      q<{ id: string }>(
        "insert into public.equipment (organization_id, name, category, notes) values ($1, 'Zaupna naprava', 'ecg', 'interno') returning id",
        [b.organizationId],
      ),
    );
    const equipmentId = equipment.rows[0]!.id;
    await asUser(b.manager.id, async (q) => {
      await q("insert into public.locations (organization_id, name) values ($1, 'Oddelek B')", [b.organizationId]);
      await q(
        `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis, responsible_user_id)
         values ($1, $2, 'inspection', 'one_off', current_date + 3, 'other', $3)`,
        [b.organizationId, equipmentId, b.manager.id],
      );
    });
    const request = await asUser(b.manager.id, (q) =>
      q<{ id: string }>(
        "insert into public.service_requests (organization_id, equipment_id, request_type, title) values ($1, $2, 'repair', 'Zaupen zahtevek') returning id",
        [b.organizationId, equipmentId],
      ),
    );
    const requestId = request.rows[0]!.id;
    await admin(
      "insert into public.service_assignments (organization_id, service_request_id, assignee_user_id) values ($1, $2, $3)",
      [b.organizationId, requestId, technician.id],
    );
    await asUser(b.manager.id, async (q) => {
      for (const visibility of ["internal", "shared"]) {
        await q(
          "insert into public.service_messages (organization_id, service_request_id, visibility, body) values ($1, $2, $3, 'x')",
          [b.organizationId, requestId, visibility],
        );
      }
      await q("select public.propose_appointment($1, now() + interval '1 day', now() + interval '26 hours')", [
        requestId,
      ]);
      await q("select public.record_completion($1, current_date, 'completed', 'Opravljeno delo.')", [requestId]);
      await q(
        "select * from public.create_pending_document($1, $2, null, 'other', 'Zaupen dokument', 'a.pdf', 'application/pdf', 10, false)",
        [b.organizationId, equipmentId],
      );
      await q("insert into public.notification_preferences (user_id, email_reminders) values ($1, true)", [
        b.manager.id,
      ]);
    });
    await asService((q) => q("select public.generate_due_reminders(current_date)"));
    await asUser(b.admin.id, (q) =>
      q(
        "insert into public.invitations (organization_id, kind, email, role, token_hash) values ($1, 'membership', 'nekdo@example.test', 'viewer', $2)",
        [b.organizationId, newToken().hash],
      ),
    );

    const { rows: tables } = await admin<{ table_name: string }>(
      `select c.table_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'organization_id' and t.table_type = 'BASE TABLE'
       order by 1`,
    );
    expect(tables.length).toBeGreaterThan(15);
    const populated: string[] = [];
    for (const { table_name } of tables) {
      const total = await admin<{ n: string }>(
        `select count(*)::text as n from public.${table_name} where organization_id = $1`,
        [b.organizationId],
      );
      if (total.rows[0]!.n !== "0") populated.push(table_name);
      for (const userId of [a.owner.id, a.viewer.id]) {
        const seen = await asUser(userId, (q) =>
          q<{ n: string }>(`select count(*)::text as n from public.${table_name} where organization_id = $1`, [
            b.organizationId,
          ]),
        );
        expect(seen.rows[0]!.n, `${table_name} visible to another organization`).toBe("0");
      }
      expect(
        await asAnon((q) => rejection(q(`select count(*) from public.${table_name}`))),
        `${table_name} readable anonymously`,
      ).toMatch(/permission denied/);
    }
    // The sweep must have covered the main data tables.
    expect(populated).toEqual(
      expect.arrayContaining([
        "audit_events",
        "completion_records",
        "documents",
        "equipment",
        "invitations",
        "locations",
        "maintenance_plans",
        "notifications",
        "organization_memberships",
        "service_events",
        "service_messages",
        "service_requests",
      ]),
    );
  });
});

describe("pilot journey", () => {
  it("runs from operator bootstrap to an acknowledged completion and a reminder e-mail", async () => {
    const ownerEmail = `lastnik-${Date.now()}@example.test`;
    const ownerToken = newToken();
    const bootstrap = await asService((q) =>
      q<{ organization_id: string; status: string }>(
        "select * from public.bootstrap_organization('Pilotna bolnišnica', 'healthcare_provider', $1, $2)",
        [ownerEmail, ownerToken.hash],
      ),
    );
    expect(bootstrap.rows[0]!.status).toBe("invitation_created");
    const org = bootstrap.rows[0]!.organization_id;

    const owner = await createAuthUser({ email: ownerEmail });
    await asUser(owner.id, (q) => q("select * from public.accept_invitation($1)", [ownerToken.hash]));

    const manager = await createAuthUser();
    const managerToken = newToken();
    await asUser(owner.id, (q) =>
      q(
        "insert into public.invitations (organization_id, kind, email, role, token_hash) values ($1, 'membership', $2, 'equipment_manager', $3)",
        [org, manager.email, managerToken.hash],
      ),
    );
    await asUser(manager.id, (q) => q("select * from public.accept_invitation($1)", [managerToken.hash]));

    const { equipmentId, planId } = await asUser(manager.id, async (q) => {
      const imported = await q<{ n: number }>("select public.import_equipment($1, $2::jsonb) as n", [
        org,
        JSON.stringify([
          {
            name: "Defibrilator D1",
            category: "defibrillation",
            location: "Urgenca",
            manufacturer_name: "Acme",
            model: "D1",
          },
        ]),
      ]);
      expect(imported.rows[0]!.n).toBe(1);
      const device = await q<{ id: string }>("select id from public.equipment where organization_id = $1", [org]);
      const plan = await q<{ id: string }>(
        `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, source_basis, responsible_user_id)
         values ($1, $2, 'inspection', 'after_completion', 12, current_date + 5, 'manufacturer_instructions', $3) returning id`,
        [org, device.rows[0]!.id, manager.id],
      );
      return { equipmentId: device.rows[0]!.id, planId: plan.rows[0]!.id };
    });

    const request = await asUser(manager.id, (q) =>
      q<{ id: string }>(
        "insert into public.service_requests (organization_id, equipment_id, plan_id, request_type, title) values ($1, $2, $3, 'inspection', 'Letni VTP') returning id",
        [org, equipmentId, planId],
      ),
    );
    const requestId = request.rows[0]!.id;

    const technician = await createAuthUser();
    const assignmentToken = newToken();
    await asUser(owner.id, (q) =>
      q(
        "insert into public.invitations (organization_id, kind, email, service_request_id, token_hash) values ($1, 'service_assignment', $2, $3, $4)",
        [org, technician.email, requestId, assignmentToken.hash],
      ),
    );
    await asUser(technician.id, (q) => q("select * from public.accept_invitation($1)", [assignmentToken.hash]));

    const proposal = await asUser(technician.id, (q) =>
      q<{ id: string }>(
        "select public.propose_appointment($1, now() + interval '2 days', now() + interval '2 days 3 hours') as id",
        [requestId],
      ),
    );
    await asUser(manager.id, (q) => q("select public.respond_appointment($1, 'accept')", [proposal.rows[0]!.id]));
    const completion = await asUser(technician.id, async (q) => {
      const version = await q<{ version: number }>("select version from public.service_requests where id = $1", [
        requestId,
      ]);
      await q("select public.transition_service_request($1, $2, 'v_izvedbi')", [requestId, version.rows[0]!.version]);
      return q<{ id: string }>(
        "select public.record_completion($1, current_date, 'completed', 'VTP opravljen, brez napak.') as id",
        [requestId],
      );
    });
    await asUser(manager.id, (q) => q("select public.acknowledge_completion($1, true)", [completion.rows[0]!.id]));

    const state = await admin<{ status: string; next_due: string; expected: string }>(
      `select r.status, p.next_due_date::text as next_due, ((current_date + interval '12 months')::date)::text as expected
       from public.service_requests r join public.maintenance_plans p on p.id = r.plan_id where r.id = $1`,
      [requestId],
    );
    expect(state.rows[0]).toMatchObject({ status: "zakljuceno" });
    expect(state.rows[0]!.next_due).toBe(state.rows[0]!.expected);

    // A second plan due in 3 days produces a reminder for the responsible person.
    await asUser(manager.id, (q) =>
      q(
        `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis, responsible_user_id)
         values ($1, $2, 'calibration', 'one_off', current_date + 3, 'service_contract', $3)`,
        [org, equipmentId, manager.id],
      ),
    );
    await asService((q) => q("select public.generate_due_reminders(current_date)"));
    const claimed = await asService((q) =>
      q<{ to_email: string; title: string }>("select to_email, title from public.claim_outbox(100)"),
    );
    expect(claimed.rows).toEqual(
      expect.arrayContaining([{ to_email: manager.email, title: "Rok čez 3 dni: Kalibracija – Defibrilator D1" }]),
    );
  });
});
