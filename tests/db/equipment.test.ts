import { afterAll, describe, expect, it } from "vitest";
import { scheduleCases } from "../shared/schedule-cases";
import { admin, asAnon, asService, asUser, createAuthUser, createTenant, pool, rejection } from "./helpers";

afterAll(async () => {
  await pool.end();
});

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function insertEquipment(tenant: Tenant, userId: string, values: Record<string, unknown> = {}) {
  return asUser(userId, async (q) => {
    const row = { organization_id: tenant.organizationId, name: "Monitor", category: "patient_monitoring", ...values };
    const keys = Object.keys(row);
    const { rows } = await q<{ id: string; version: number; created_by: string }>(
      `insert into public.equipment (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})
       returning id, version, created_by`,
      Object.values(row),
    );
    return rows[0]!;
  });
}

async function insertLocation(tenant: Tenant, userId: string, name = "Urgenca") {
  return asUser(userId, async (q) => {
    const { rows } = await q<{ id: string }>(
      "insert into public.locations (organization_id, name) values ($1, $2) returning id",
      [tenant.organizationId, name],
    );
    return rows[0]!.id;
  });
}

describe("equipment register", () => {
  it("lets managers write, viewers read, and outsiders see nothing", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    const device = await insertEquipment(tenant, tenant.manager.id, { asset_tag: "INV-1" });
    expect(device.version).toBe(1);
    expect(device.created_by).toBe(tenant.manager.id);

    const seenByViewer = await asUser(tenant.viewer.id, (q) => q("select id from public.equipment"));
    expect(seenByViewer.rows.map((r) => r.id)).toEqual([device.id]);

    expect(await rejection(insertEquipment(tenant, tenant.viewer.id))).toMatch(/row-level security/);
    const viewerUpdate = await asUser(tenant.viewer.id, (q) =>
      q("update public.equipment set name = 'Spremenjeno' where id = $1", [device.id]),
    );
    expect(viewerUpdate.rowCount).toBe(0);

    const outsiderView = await asUser(outsider.id, (q) =>
      q("select id from public.equipment where id = $1", [device.id]),
    );
    expect(outsiderView.rowCount).toBe(0);
    expect((await asAnon((q) => rejection(q("select id from public.equipment")))) as string).toMatch(
      /permission denied/,
    );
  });

  it("has no delete privilege and bumps the version on update", async () => {
    const tenant = await createTenant();
    const device = await insertEquipment(tenant, tenant.manager.id);
    expect(
      await rejection(asUser(tenant.owner.id, (q) => q("delete from public.equipment where id = $1", [device.id]))),
    ).toMatch(/permission denied/);
    const { rows } = await asUser(tenant.admin.id, (q) =>
      q<{ version: number; updated_by: string }>(
        "update public.equipment set status = 'in_service' where id = $1 returning version, updated_by",
        [device.id],
      ),
    );
    expect(rows[0]).toEqual({ version: 2, updated_by: tenant.admin.id });
  });

  it("does not let clients forge authorship or the version", async () => {
    const tenant = await createTenant();
    expect(await rejection(insertEquipment(tenant, tenant.manager.id, { created_by: tenant.owner.id }))).toMatch(
      /permission denied/,
    );
    const device = await insertEquipment(tenant, tenant.manager.id);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) => q("update public.equipment set version = 99 where id = $1", [device.id])),
      ),
    ).toMatch(/permission denied/);
  });

  it("keeps devices, locations and plans inside one organization", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const locationB = await insertLocation(b, b.manager.id);
    const deviceA = await insertEquipment(a, a.manager.id);

    // Insert into another organization.
    expect(await rejection(insertEquipment(b, a.manager.id))).toMatch(/row-level security/);
    // Reference another organization's location.
    expect(await rejection(insertEquipment(a, a.manager.id, { location_id: locationB }))).toMatch(/foreign key/);
    // Move a device to another organization (manager of both).
    await admin(
      "insert into public.organization_memberships (organization_id, user_id, role) values ($1, $2, 'equipment_manager')",
      [b.organizationId, a.manager.id],
    );
    expect(
      await rejection(
        asUser(a.manager.id, (q) =>
          q("update public.equipment set organization_id = $1 where id = $2", [b.organizationId, deviceA.id]),
        ),
      ),
    ).toMatch(/permission denied|TM_ORGANIZATION_IMMUTABLE/);
    expect(
      await rejection(
        asService((q) =>
          q("update public.equipment set organization_id = $1 where id = $2", [b.organizationId, deviceA.id]),
        ),
      ),
    ).toMatch(/TM_ORGANIZATION_IMMUTABLE/);
    // Plan in organization B for a device of organization A.
    expect(
      await rejection(
        asUser(a.manager.id, (q) =>
          q(
            `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, source_basis)
             values ($1, $2, 'inspection', 'fixed_calendar', 12, '2026-01-01', 'manufacturer_instructions')`,
            [b.organizationId, deviceA.id],
          ),
        ),
      ),
    ).toMatch(/foreign key/);
  });

  it("requires the responsible person to be a member of the organization", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    expect(await rejection(insertEquipment(tenant, tenant.manager.id, { responsible_user_id: outsider.id }))).toMatch(
      /TM_RESPONSIBLE_NOT_MEMBER/,
    );
    const device = await insertEquipment(tenant, tenant.manager.id, { responsible_user_id: tenant.viewer.id });
    expect(device.id).toBeTruthy();
  });

  it("enforces unique asset tags and serial numbers per organization (case-insensitive)", async () => {
    const a = await createTenant();
    const b = await createTenant();
    await insertEquipment(a, a.manager.id, { asset_tag: "INV-7", manufacturer_name: "Acme", serial_number: "SN-1" });
    expect(await rejection(insertEquipment(a, a.manager.id, { asset_tag: "inv-7" }))).toMatch(/duplicate key/);
    expect(
      await rejection(insertEquipment(a, a.manager.id, { manufacturer_name: "ACME", serial_number: "sn-1" })),
    ).toMatch(/duplicate key/);
    // Same identifiers are fine in another organization.
    await insertEquipment(b, b.manager.id, { asset_tag: "INV-7", manufacturer_name: "Acme", serial_number: "SN-1" });
  });

  it("records audit events with changed column names only", async () => {
    const tenant = await createTenant();
    const device = await insertEquipment(tenant, tenant.manager.id, { notes: "zaupno" });
    await asUser(tenant.manager.id, (q) => q("update public.equipment set notes = 'drugo' where id = $1", [device.id]));
    const { rows } = await asUser(tenant.viewer.id, (q) =>
      q<{ action: string; changed_columns: string[]; actor_user_id: string }>(
        "select action, changed_columns, actor_user_id from public.audit_events where entity_id = $1 order by id",
        [device.id],
      ),
    );
    expect(rows.map((r) => r.action)).toEqual(["insert", "update"]);
    expect(rows[1]!.changed_columns).toEqual(["notes"]);
    expect(JSON.stringify(rows)).not.toContain("zaupno");
  });
});

describe("maintenance plans", () => {
  it("matches the TypeScript scheduler for every shared case", async () => {
    for (const c of scheduleCases) {
      const { rows } = await admin<{ next: string | null }>(
        "select private.compute_next_due($1, $2, $3, $4, $5::date[])::text as next",
        [c.plan.mode, c.plan.intervalMonths, c.plan.anchorDate, c.plan.dueDate, [...c.completions].sort()],
      );
      expect(rows[0]!.next, c.name).toBe(c.expected);
    }
  });

  it("derives next_due_date and rejects inconsistent shapes", async () => {
    const tenant = await createTenant();
    const device = await insertEquipment(tenant, tenant.manager.id);
    const plan = await asUser(tenant.manager.id, (q) =>
      q<{ id: string; next_due_date: string }>(
        `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, source_basis)
         values ($1, $2, 'calibration', 'after_completion', 12, '2026-03-01', 'service_contract')
         returning id, next_due_date::text`,
        [tenant.organizationId, device.id],
      ),
    );
    expect(plan.rows[0]!.next_due_date).toBe("2026-03-01");

    const updated = await asUser(tenant.manager.id, (q) =>
      q<{ next_due_date: string }>(
        "update public.maintenance_plans set anchor_date = '2026-04-01' where id = $1 returning next_due_date::text",
        [plan.rows[0]!.id],
      ),
    );
    expect(updated.rows[0]!.next_due_date).toBe("2026-04-01");

    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q(
            `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, source_basis)
             values ($1, $2, 'inspection', 'one_off', 12, '2026-03-01', 'other')`,
            [tenant.organizationId, device.id],
          ),
        ),
      ),
    ).toMatch(/maintenance_plans_shape_chk/);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q(
            `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis, reminder_days)
             values ($1, $2, 'inspection', 'one_off', '2026-03-01', 'other', '{400}')`,
            [tenant.organizationId, device.id],
          ),
        ),
      ),
    ).toMatch(/maintenance_plans_reminders_chk/);
    // Clients cannot write derived columns.
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q("update public.maintenance_plans set next_due_date = '2030-01-01' where id = $1", [plan.rows[0]!.id]),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("exposes the earliest due date through the overview view under RLS", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const location = await insertLocation(tenant, tenant.manager.id, "Fizioterapija");
    const device = await insertEquipment(tenant, tenant.manager.id, { location_id: location });
    await insertEquipment(other, other.manager.id);
    await asUser(tenant.manager.id, async (q) => {
      for (const [mode, interval, anchor, due] of [
        ["fixed_calendar", 12, "2027-01-01", null],
        ["one_off", null, null, "2026-12-15"],
      ] as const) {
        await q(
          `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, due_date, source_basis)
           values ($1, $2, 'inspection', $3, $4, $5, $6, 'other')`,
          [tenant.organizationId, device.id, mode, interval, anchor, due],
        );
      }
    });
    const { rows } = await asUser(tenant.viewer.id, (q) =>
      q<{ id: string; location_name: string; next_due_date: string }>(
        "select id, location_name, next_due_date::text from public.equipment_overview",
      ),
    );
    expect(rows).toEqual([{ id: device.id, location_name: "Fizioterapija", next_due_date: "2026-12-15" }]);
  });
});

describe("maintenance agenda", () => {
  it("lists open due dates of active plans on non-archived equipment only", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const kept = await insertEquipment(tenant, tenant.manager.id, { name: "Ostane" });
    const archived = await insertEquipment(tenant, tenant.manager.id, { name: "Arhivirana" });
    const foreign = await insertEquipment(other, other.manager.id);
    const addPlan = (userId: string, org: string, equipmentId: string, due: string) =>
      asUser(userId, (q) =>
        q<{ id: string }>(
          `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis)
           values ($1, $2, 'inspection', 'one_off', $3, 'other') returning id`,
          [org, equipmentId, due],
        ),
      );
    const keptPlan = await addPlan(tenant.manager.id, tenant.organizationId, kept.id, "2026-12-01");
    const archivedPlan = await addPlan(tenant.manager.id, tenant.organizationId, kept.id, "2026-12-02");
    await addPlan(tenant.manager.id, tenant.organizationId, archived.id, "2026-12-03");
    await addPlan(other.manager.id, other.organizationId, foreign.id, "2026-12-04");
    await asUser(tenant.manager.id, async (q) => {
      await q("update public.equipment set status = 'archived' where id = $1", [archived.id]);
      await q("update public.maintenance_plans set status = 'archived' where id = $1", [archivedPlan.rows[0]!.id]);
    });
    const { rows } = await asUser(tenant.viewer.id, (q) =>
      q<{ id: string; equipment_name: string }>("select id, equipment_name from public.maintenance_agenda"),
    );
    expect(rows).toEqual([{ id: keptPlan.rows[0]!.id, equipment_name: "Ostane" }]);
  });
});

describe("equipment import", () => {
  const row = (name: string, extra: Record<string, string> = {}) => ({ name, category: "ecg", ...extra });

  it("imports all rows in one transaction and creates missing locations", async () => {
    const tenant = await createTenant();
    const existing = await insertLocation(tenant, tenant.manager.id, "Urgenca");
    const { rows } = await asUser(tenant.manager.id, (q) =>
      q<{ count: number }>("select public.import_equipment($1, $2::jsonb) as count", [
        tenant.organizationId,
        JSON.stringify([
          row("EKG 1", { location: "urgenca" }),
          row("EKG 2", { location: "Kardiologija", purchase_date: "2024-01-02" }),
        ]),
      ]),
    );
    expect(rows[0]!.count).toBe(2);
    const devices = await asUser(tenant.viewer.id, (q) =>
      q<{ name: string; location_id: string; location_name: string }>(
        "select name, location_id, location_name from public.equipment_overview order by name",
      ),
    );
    expect(devices.rows[0]!.location_id).toBe(existing);
    expect(devices.rows[1]!.location_name).toBe("Kardiologija");
  });

  it("rolls back every row when one row fails", async () => {
    const tenant = await createTenant();
    const error = await rejection(
      asUser(tenant.manager.id, (q) =>
        q("select public.import_equipment($1, $2::jsonb)", [
          tenant.organizationId,
          JSON.stringify([row("EKG 1", { location: "Nova lokacija" }), row("EKG 2", { category: "neznano" })]),
        ]),
      ),
    );
    expect(error).toMatch(/equipment_category_chk/);
    const counts = await admin<{ devices: string; locations: string }>(
      `select (select count(*) from public.equipment where organization_id = $1) as devices,
              (select count(*) from public.locations where organization_id = $1) as locations`,
      [tenant.organizationId],
    );
    expect(counts.rows[0]).toEqual({ devices: "0", locations: "0" });
  });

  it("is limited to managers of the organization and to 500 rows", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    for (const userId of [tenant.viewer.id, other.owner.id]) {
      expect(
        await rejection(
          asUser(userId, (q) =>
            q("select public.import_equipment($1, $2::jsonb)", [tenant.organizationId, JSON.stringify([row("EKG")])]),
          ),
        ),
      ).toMatch(/TM_FORBIDDEN/);
    }
    const many = Array.from({ length: 501 }, (_, i) => row(`EKG ${i}`));
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q("select public.import_equipment($1, $2::jsonb)", [tenant.organizationId, JSON.stringify(many)]),
        ),
      ),
    ).toMatch(/TM_IMPORT_TOO_LARGE/);
    expect(
      await asAnon((q) => rejection(q("select public.import_equipment($1, '[]'::jsonb)", [tenant.organizationId]))),
    ).toMatch(/permission denied/);
  });
});
