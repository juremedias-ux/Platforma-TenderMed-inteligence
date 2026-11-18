import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, asService, asUser, createAuthUser, createTenant, pool, rejection } from "./helpers";

afterAll(async () => {
  await pool.end();
});

type Tenant = Awaited<ReturnType<typeof createTenant>>;

const TODAY = "2026-11-10";

async function planDueIn(
  tenant: Tenant,
  days: number,
  options: { responsible?: string | null; reminders?: number[] } = {},
) {
  const equipment = await admin<{ id: string }>(
    "insert into public.equipment (organization_id, name, category, asset_tag) values ($1, 'Infuzijska črpalka', 'infusion', $2) returning id",
    [tenant.organizationId, `INV-${randomUUID().slice(0, 8)}`],
  );
  const plan = await admin<{ id: string }>(
    `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis, responsible_user_id, reminder_days)
     values ($1, $2, 'inspection', 'one_off', $3::date + $4::integer, 'manufacturer_instructions', $5, $6) returning id`,
    [
      tenant.organizationId,
      equipment.rows[0]!.id,
      TODAY,
      days,
      options.responsible ?? null,
      options.reminders ?? [30, 7],
    ],
  );
  return plan.rows[0]!.id;
}

const generate = (today = TODAY) =>
  asService((q) => q<{ n: number }>("select public.generate_due_reminders($1::date) as n", [today])).then(
    (r) => r.rows[0]!.n,
  );

const notificationsFor = (userId: string) =>
  asUser(userId, (q) =>
    q<{ kind: string; title: string; event_key: string; link_path: string }>(
      "select kind, title, event_key, link_path from public.notifications order by created_at",
    ),
  ).then((r) => r.rows);

const outboxFor = (userId: string) =>
  admin<{ status: string; event_key: string }>(
    "select status, event_key from public.email_outbox where recipient_user_id = $1",
    [userId],
  ).then((r) => r.rows);

describe("due-date reminders", () => {
  it("notifies the responsible person once per lead time and respects e-mail preferences", async () => {
    const tenant = await createTenant();
    const plan = await planDueIn(tenant, 7, { responsible: tenant.viewer.id });
    await generate();
    await generate();
    const viewer = await notificationsFor(tenant.viewer.id);
    expect(viewer).toHaveLength(1);
    expect(viewer[0]).toMatchObject({ kind: "due_reminder", event_key: `due:${plan}:2026-11-17:7` });
    expect(viewer[0]!.title).toBe("Rok čez 7 dni: Varnostno-tehnični pregled – Infuzijska črpalka");
    expect(await notificationsFor(tenant.manager.id)).toEqual([]);
    expect(await outboxFor(tenant.viewer.id)).toHaveLength(1);

    await asUser(tenant.owner.id, (q) =>
      q("insert into public.notification_preferences (user_id, email_reminders) values ($1, false)", [tenant.owner.id]),
    );
    await admin("update public.organizations set reminder_audience = 'operators' where id = $1", [
      tenant.organizationId,
    ]);
    await generate("2026-11-11");
    expect((await notificationsFor(tenant.owner.id)).length).toBe(1);
    expect(await outboxFor(tenant.owner.id)).toEqual([]);
    expect((await outboxFor(tenant.manager.id)).length).toBe(1);
  });

  it("falls back to operators, catches up missed days and repeats overdue reminders weekly", async () => {
    const tenant = await createTenant();
    const soon = await planDueIn(tenant, 5);
    const overdue = await planDueIn(tenant, -1, { reminders: [] });
    await generate();
    const keys = (await notificationsFor(tenant.admin.id)).map((n) => n.event_key).sort();
    expect(keys).toEqual([`due:${soon}:2026-11-15:7`, `overdue:${overdue}:2026-11-09:0`].sort());
    expect(await notificationsFor(tenant.viewer.id)).toEqual([]);

    await generate("2026-11-12");
    expect((await notificationsFor(tenant.admin.id)).length).toBe(2);
    await generate("2026-11-17");
    const later = (await notificationsFor(tenant.admin.id)).map((n) => n.event_key);
    expect(later).toContain(`overdue:${overdue}:2026-11-09:1`);
  });
});

describe("service update notifications", () => {
  it("notifies the other side of a request, never the actor, and not for internal messages", async () => {
    const tenant = await createTenant();
    const technician = await createAuthUser();
    const equipment = await admin<{ id: string }>(
      "insert into public.equipment (organization_id, name, category) values ($1, 'EKG', 'ecg') returning id",
      [tenant.organizationId],
    );
    const request = await asUser(tenant.manager.id, (q) =>
      q<{ id: string }>(
        "insert into public.service_requests (organization_id, equipment_id, request_type, title) values ($1, $2, 'repair', 'Okvara') returning id",
        [tenant.organizationId, equipment.rows[0]!.id],
      ),
    );
    const requestId = request.rows[0]!.id;
    await admin(
      "insert into public.service_assignments (organization_id, service_request_id, assignee_user_id) values ($1, $2, $3)",
      [tenant.organizationId, requestId, technician.id],
    );
    expect((await notificationsFor(technician.id)).map((n) => n.kind)).toEqual(["assignment"]);

    const proposal = await asUser(technician.id, (q) =>
      q<{ id: string }>(
        "select public.propose_appointment($1, now() + interval '2 days', now() + interval '2 days 2 hours') as id",
        [requestId],
      ),
    );
    const managerNotes = await notificationsFor(tenant.manager.id);
    expect(managerNotes.map((n) => n.title)).toEqual(["Nov predlog termina – #1 Okvara"]);
    expect(managerNotes[0]!.link_path).toBe(`/app/${tenant.organizationId}/servisi/${requestId}`);
    expect(await notificationsFor(tenant.admin.id)).toEqual([]);

    await asUser(tenant.admin.id, (q) => q("select public.respond_appointment($1, 'accept')", [proposal.rows[0]!.id]));
    const techNotes = await notificationsFor(technician.id);
    expect(techNotes.map((n) => n.title)).toContain("Termin je potrjen – #1 Okvara");
    expect(techNotes.at(-1)!.link_path).toBe(`/app/servisne-naloge/${requestId}`);

    const message = (userId: string, visibility: string) =>
      asUser(userId, (q) =>
        q(
          "insert into public.service_messages (organization_id, service_request_id, visibility, body) values ($1, $2, $3, 'Besedilo')",
          [tenant.organizationId, requestId, visibility],
        ),
      );
    const before = (await notificationsFor(technician.id)).length;
    await message(tenant.manager.id, "internal");
    expect((await notificationsFor(technician.id)).length).toBe(before);
    await message(tenant.manager.id, "shared");
    expect((await notificationsFor(technician.id)).length).toBe(before + 1);
    expect(JSON.stringify(await notificationsFor(technician.id))).not.toContain("Besedilo");
  });
});

describe("notification access", () => {
  it("lets users read and mark only their own notifications and keeps the outbox server-only", async () => {
    const tenant = await createTenant();
    await planDueIn(tenant, 3, { responsible: tenant.viewer.id });
    await generate();
    const own = await asUser(tenant.viewer.id, (q) =>
      q("update public.notifications set read_at = now() where read_at is null returning id"),
    );
    expect(own.rowCount).toBe(1);
    expect(
      await rejection(asUser(tenant.viewer.id, (q) => q("update public.notifications set title = 'x' returning id"))),
    ).toMatch(/permission denied/);
    expect((await asUser(tenant.manager.id, (q) => q("select id from public.notifications"))).rowCount).toBe(0);
    for (const sql of [
      "select id from public.email_outbox",
      "select public.generate_due_reminders(current_date)",
      "select * from public.claim_outbox(5)",
      "select public.complete_outbox(1, 'sent')",
    ]) {
      expect(await rejection(asUser(tenant.owner.id, (q) => q(sql)))).toMatch(/permission denied/);
    }
  });
});

describe("notification preferences", () => {
  it("lets users upsert only their own preferences (PostgREST upsert shape)", async () => {
    const tenant = await createTenant();
    const upsert = (actor: string, target: string, reminders: boolean) =>
      asUser(actor, (q) =>
        q(
          `insert into public.notification_preferences (user_id, email_reminders, email_service_updates) values ($1, $2, true)
           on conflict (user_id) do update set user_id = excluded.user_id, email_reminders = excluded.email_reminders,
             email_service_updates = excluded.email_service_updates`,
          [target, reminders],
        ),
      );
    await upsert(tenant.viewer.id, tenant.viewer.id, false);
    await upsert(tenant.viewer.id, tenant.viewer.id, true);
    expect(await rejection(upsert(tenant.viewer.id, tenant.owner.id, false))).toMatch(/row-level security/);
    const rows = await admin<{ email_reminders: boolean }>(
      "select email_reminders from public.notification_preferences where user_id = $1",
      [tenant.viewer.id],
    );
    expect(rows.rows).toEqual([{ email_reminders: true }]);
  });
});

describe("invitation acceptance", () => {
  it("tells the organization (not the technician) when a technician accepts", async () => {
    const tenant = await createTenant();
    const technician = await createAuthUser();
    const equipment = await admin<{ id: string }>(
      "insert into public.equipment (organization_id, name, category) values ($1, 'Aspirator', 'suction') returning id",
      [tenant.organizationId],
    );
    const request = await asUser(tenant.manager.id, (q) =>
      q<{ id: string }>(
        "insert into public.service_requests (organization_id, equipment_id, request_type, title) values ($1, $2, 'repair', 'Servis') returning id",
        [tenant.organizationId, equipment.rows[0]!.id],
      ),
    );
    const { createHash, randomBytes } = await import("node:crypto");
    const hash = createHash("sha256").update(randomBytes(32).toString("base64url")).digest();
    await asUser(tenant.admin.id, (q) =>
      q(
        "insert into public.invitations (organization_id, kind, email, service_request_id, token_hash) values ($1, 'service_assignment', $2, $3, $4)",
        [tenant.organizationId, technician.email, request.rows[0]!.id, hash],
      ),
    );
    await asUser(technician.id, (q) => q("select * from public.accept_invitation($1)", [hash]));
    expect(await notificationsFor(technician.id)).toEqual([]);
    expect((await notificationsFor(tenant.manager.id)).map((n) => n.title)).toEqual([
      "Serviser je sprejel povabilo – #1 Servis",
    ]);
  });
});

describe("e-mail outbox", () => {
  async function pendingFor(tenant: Tenant) {
    await planDueIn(tenant, 2, { responsible: tenant.viewer.id });
    await generate();
    const { rows } = await admin<{ id: string }>("select id from public.email_outbox where recipient_user_id = $1", [
      tenant.viewer.id,
    ]);
    return rows[0]!.id;
  }

  it("claims each row once (SKIP LOCKED), re-checks access and records results with backoff", async () => {
    const tenant = await createTenant();
    const id = await pendingFor(tenant);
    const other = await createTenant();
    const lostAccess = await pendingFor(other);
    await admin("delete from public.organization_memberships where organization_id = $1 and user_id = $2", [
      other.organizationId,
      other.viewer.id,
    ]);

    const first = await pool.connect();
    try {
      await first.query("begin");
      await first.query("set local role service_role");
      const claimed = await first.query<{ id: string; to_email: string }>("select * from public.claim_outbox(100)");
      const mine = claimed.rows.find((r) => r.id === id);
      expect(mine?.to_email).toBe(tenant.viewer.email);
      expect(claimed.rows.some((r) => r.id === lostAccess)).toBe(false);
      const concurrent = await asService((q) => q<{ id: string }>("select * from public.claim_outbox(100)"));
      expect(concurrent.rows.some((r) => r.id === id)).toBe(false);
      await first.query("commit");
    } finally {
      first.release();
    }
    const states = await admin<{ id: string; status: string; last_error: string | null }>(
      "select id, status, last_error from public.email_outbox where id = any($1::bigint[])",
      [[id, lostAccess]],
    );
    expect(Object.fromEntries(states.rows.map((r) => [r.id, r.status]))).toEqual({
      [id]: "sending",
      [lostAccess]: "cancelled",
    });

    await asService((q) => q("select public.complete_outbox($1, 'retry', null, 'timeout')", [id]));
    const retry = await admin<{ status: string; wait: number }>(
      "select status, extract(epoch from next_attempt_at - now())::integer as wait from public.email_outbox where id = $1",
      [id],
    );
    expect(retry.rows[0]!.status).toBe("pending");
    expect(retry.rows[0]!.wait).toBeGreaterThan(200);

    await admin("update public.email_outbox set attempts = 5, status = 'sending' where id = $1", [id]);
    await asService((q) => q("select public.complete_outbox($1, 'retry', null, 'timeout')", [id]));
    expect(
      (await admin<{ status: string }>("select status from public.email_outbox where id = $1", [id])).rows[0]!.status,
    ).toBe("failed");
  });

  it("retries stale sends within the idempotency window and marks older ones unknown", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const recent = await pendingFor(a);
    const old = await pendingFor(b);
    await admin(
      "update public.email_outbox set status = 'sending', locked_at = now() - interval '1 hour' where id = $1",
      [recent],
    );
    await admin(
      "update public.email_outbox set status = 'sending', locked_at = now() - interval '1 hour', created_at = now() - interval '2 days' where id = $1",
      [old],
    );
    await asService((q) => q("select * from public.claim_outbox(100)"));
    const rows = await admin<{ id: string; status: string; attempts: number }>(
      "select id, status, attempts from public.email_outbox where id = any($1::bigint[])",
      [[recent, old]],
    );
    const byId = Object.fromEntries(rows.rows.map((r) => [r.id, r]));
    expect(byId[recent]!.status).toBe("sending");
    expect(byId[recent]!.attempts).toBe(1);
    expect(byId[old]!.status).toBe("unknown");
  });
});
