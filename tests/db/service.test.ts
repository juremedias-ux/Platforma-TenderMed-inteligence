import { afterAll, describe, expect, it } from "vitest";
import { admin, asUser, createAuthUser, createTenant, newToken, pool, rejection, type Query } from "./helpers";

afterAll(async () => {
  await pool.end();
});

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function setup(options: { plan?: boolean } = {}) {
  const tenant = await createTenant();
  const technician = await createAuthUser();
  const { rows } = await admin<{ id: string }>(
    "insert into public.equipment (organization_id, name, category, notes) values ($1, 'Defibrilator', 'defibrillation', 'interna opomba') returning id",
    [tenant.organizationId],
  );
  const equipmentId = rows[0]!.id;
  let planId: string | null = null;
  if (options.plan) {
    const plan = await admin<{ id: string }>(
      `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, interval_months, anchor_date, source_basis)
       values ($1, $2, 'inspection', 'after_completion', 12, '2026-01-15', 'manufacturer_instructions') returning id`,
      [tenant.organizationId, equipmentId],
    );
    planId = plan.rows[0]!.id;
  }
  const request = await createRequest(tenant, tenant.manager.id, equipmentId, planId);
  return { tenant, technician, equipmentId, planId, requestId: request.id };
}

async function createRequest(tenant: Tenant, userId: string, equipmentId: string, planId: string | null = null) {
  return asUser(userId, async (q) => {
    const { rows } = await q<{ id: string; status: string; reference_number: number; version: number }>(
      `insert into public.service_requests (organization_id, equipment_id, plan_id, request_type, title)
       values ($1, $2, $3, 'inspection', 'Letni pregled') returning id, status, reference_number, version`,
      [tenant.organizationId, equipmentId, planId],
    );
    return rows[0]!;
  });
}

async function assign(tenant: Tenant, requestId: string, userId: string) {
  await admin(
    "insert into public.service_assignments (organization_id, service_request_id, assignee_user_id, assigned_by) values ($1, $2, $3, $4)",
    [tenant.organizationId, requestId, userId, tenant.admin.id],
  );
}

/** Version as seen inside the caller's transaction. */
const versionIn = async (q: Query, requestId: string) =>
  (await q<{ version: number }>("select version from public.service_requests where id = $1", [requestId])).rows[0]!
    .version;

const version = async (requestId: string) =>
  (await admin<{ version: number }>("select version from public.service_requests where id = $1", [requestId])).rows[0]!
    .version;

const request = async (requestId: string) =>
  (
    await admin<{ status: string; scheduled_start: Date | null; closed_at: Date | null; replacement_status: string }>(
      "select status, scheduled_start, closed_at, replacement_status from public.service_requests where id = $1",
      [requestId],
    )
  ).rows[0]!;

const transition = (q: Query, requestId: string, v: number, to: string, note: string | null = null) =>
  q("select public.transition_service_request($1, $2, $3, $4)", [requestId, v, to, note]);

const propose = (q: Query, requestId: string, hoursFromNow = 48) =>
  q<{ id: string }>(
    "select public.propose_appointment($1, now() + make_interval(hours => $2), now() + make_interval(hours => $2 + 2), 'Predlog') as id",
    [requestId, hoursFromNow],
  ).then((r) => r.rows[0]!.id);

const record = (
  q: Query,
  requestId: string,
  outcome = "completed",
  replaces: string | null = null,
  on = "2026-11-01",
) =>
  q<{ id: string }>("select public.record_completion($1, $2::date, $3, 'Pregled opravljen.', $4) as id", [
    requestId,
    on,
    outcome,
    replaces,
  ]).then((r) => r.rows[0]!.id);

const nextDue = async (planId: string) =>
  (
    await admin<{ d: string | null }>("select next_due_date::text as d from public.maintenance_plans where id = $1", [
      planId,
    ])
  ).rows[0]!.d;

/** Brings a request to termin_potrjen with an accepted appointment proposed by the technician. */
async function confirmAppointment(s: Awaited<ReturnType<typeof setup>>) {
  const proposal = await asUser(s.technician.id, (q) => propose(q, s.requestId));
  await asUser(s.tenant.manager.id, (q) => q("select public.respond_appointment($1, 'accept')", [proposal]));
  return proposal;
}

describe("service requests", () => {
  it("lets operators create requests with database-controlled status and per-organization numbers", async () => {
    const s = await setup();
    const second = await createRequest(s.tenant, s.tenant.admin.id, s.equipmentId);
    expect(second.status).toBe("novo");
    expect(second.reference_number).toBe(2);
    const other = await setup();
    expect(
      (
        await admin<{ n: number }>("select reference_number as n from public.service_requests where id = $1", [
          other.requestId,
        ])
      ).rows[0]!.n,
    ).toBe(1);

    expect(await rejection(createRequest(s.tenant, s.tenant.viewer.id, s.equipmentId))).toMatch(/row-level security/);
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) =>
          q("update public.service_requests set status = 'zakljuceno' where id = $1", [s.requestId]),
        ),
      ),
    ).toMatch(/permission denied/);
    const events = await asUser(s.tenant.viewer.id, (q) =>
      q<{ event_type: string }>("select event_type from public.service_events where service_request_id = $1", [
        s.requestId,
      ]),
    );
    expect(events.rows.map((e) => e.event_type)).toEqual(["created"]);
  });

  it("rejects references to another organization, mismatched plans and archived equipment", async () => {
    const s = await setup({ plan: true });
    const other = await setup();
    expect(await rejection(createRequest(s.tenant, s.tenant.manager.id, other.equipmentId))).toMatch(/foreign key/);
    const device = await admin<{ id: string }>(
      "insert into public.equipment (organization_id, name, category) values ($1, 'Drugi', 'ecg') returning id",
      [s.tenant.organizationId],
    );
    expect(await rejection(createRequest(s.tenant, s.tenant.manager.id, device.rows[0]!.id, s.planId))).toMatch(
      /TM_PLAN_MISMATCH/,
    );
    await admin("update public.equipment set status = 'archived' where id = $1", [device.rows[0]!.id]);
    expect(await rejection(createRequest(s.tenant, s.tenant.manager.id, device.rows[0]!.id))).toMatch(
      /TM_EQUIPMENT_ARCHIVED/,
    );
  });

  it("enforces optimistic concurrency and allowed transitions", async () => {
    const s = await setup();
    expect(
      await rejection(asUser(s.tenant.manager.id, (q) => transition(q, s.requestId, 99, "v_usklajevanju"))),
    ).toMatch(/TM_VERSION_CONFLICT/);
    expect(
      await rejection(asUser(s.tenant.manager.id, (q) => transition(q, s.requestId, 1, "termin_potrjen"))),
    ).toMatch(/TM_TRANSITION_NOT_ALLOWED/);
    expect(await rejection(asUser(s.tenant.viewer.id, (q) => transition(q, s.requestId, 1, "v_usklajevanju")))).toMatch(
      /TM_TRANSITION_NOT_ALLOWED/,
    );
    expect(await rejection(asUser(s.tenant.manager.id, (q) => transition(q, s.requestId, 1, "zakljuceno")))).toMatch(
      /TM_TRANSITION_NOT_ALLOWED/,
    );
    const outsider = await createAuthUser();
    expect(await rejection(asUser(outsider.id, (q) => transition(q, s.requestId, 1, "v_usklajevanju")))).toMatch(
      /TM_NOT_FOUND/,
    );
  });

  it("requires a reason to cancel and blocks cancellation with an active completion", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    expect(await rejection(asUser(s.tenant.manager.id, (q) => transition(q, s.requestId, 1, "preklicano")))).toMatch(
      /TM_REASON_REQUIRED/,
    );
    expect(
      await rejection(asUser(s.technician.id, (q) => transition(q, s.requestId, 1, "preklicano", "Ni potrebe"))),
    ).toMatch(/TM_TRANSITION_NOT_ALLOWED/);
    await asUser(s.tenant.manager.id, (q) => record(q, s.requestId));
    expect(
      await rejection(
        asUser(s.tenant.manager.id, async (q) =>
          transition(q, s.requestId, await version(s.requestId), "preklicano", "Ni potrebe"),
        ),
      ),
    ).toMatch(/TM_REQUEST_HAS_COMPLETION/);

    const t = await setup();
    await asUser(t.tenant.manager.id, (q) => transition(q, t.requestId, 1, "preklicano", "Naprava odpisana"));
    expect(await request(t.requestId)).toMatchObject({ status: "preklicano" });
    expect(
      await rejection(
        asUser(t.tenant.manager.id, (q) =>
          q("update public.service_requests set title = 'Novo ime' where id = $1", [t.requestId]),
        ),
      ),
    ).toMatch(/TM_REQUEST_CLOSED/);
  });
});

describe("assignments", () => {
  it("assigns an external technician through an invitation and limits what they see", async () => {
    const s = await setup();
    const { hash } = newToken();
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) =>
          q(
            "insert into public.invitations (organization_id, kind, email, service_request_id, token_hash) values ($1, 'service_assignment', $2, $3, $4)",
            [s.tenant.organizationId, s.technician.email, s.requestId, newToken().hash],
          ),
        ),
      ),
    ).toMatch(/row-level security/);
    await asUser(s.tenant.admin.id, (q) =>
      q(
        "insert into public.invitations (organization_id, kind, email, service_request_id, token_hash) values ($1, 'service_assignment', $2, $3, $4)",
        [s.tenant.organizationId, s.technician.email, s.requestId, hash],
      ),
    );
    const accepted = await asUser(s.technician.id, (q) =>
      q<{ kind: string; service_request_id: string }>("select * from public.accept_invitation($1)", [hash]),
    );
    expect(accepted.rows[0]).toMatchObject({ kind: "service_assignment", service_request_id: s.requestId });

    const other = await createRequest(s.tenant, s.tenant.manager.id, s.equipmentId);
    await asUser(s.technician.id, async (q) => {
      const requests = await q<{ id: string }>("select id from public.service_requests");
      expect(requests.rows.map((r) => r.id)).toEqual([s.requestId]);
      expect((await q("select id from public.equipment")).rowCount).toBe(0);
      expect((await q("select id from public.organizations")).rowCount).toBe(0);
      expect((await q("select user_id from public.organization_memberships")).rowCount).toBe(0);
      expect((await q("select id from public.audit_events")).rowCount).toBe(0);
      const brief = await q<{ equipment_name: string; organization_name: string }>(
        "select * from public.service_request_brief($1)",
        [s.requestId],
      );
      expect(brief.rows[0]!.equipment_name).toBe("Defibrilator");
      expect(JSON.stringify(brief.rows[0])).not.toContain("interna opomba");
      expect((await q("select * from public.service_request_brief($1)", [other.id])).rowCount).toBe(0);
      const mine = await q<{ service_request_id: string }>("select * from public.my_service_assignments()");
      expect(mine.rows.map((r) => r.service_request_id)).toEqual([s.requestId]);
      const profiles = await q<{ id: string }>("select id from public.profiles");
      expect(profiles.rows.map((r) => r.id)).toEqual(
        expect.arrayContaining([s.technician.id, s.tenant.manager.id, s.tenant.viewer.id]),
      );
    });
    const visibleToMember = await asUser(s.tenant.viewer.id, (q) =>
      q("select id from public.profiles where id = $1", [s.technician.id]),
    );
    expect(visibleToMember.rowCount).toBe(1);
    const outsider = await createAuthUser();
    expect(
      (await asUser(outsider.id, (q) => q("select id from public.profiles where id = $1", [s.technician.id]))).rowCount,
    ).toBe(0);
  });

  it("does not create assignment invitations for closed requests and revokes access", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    await asUser(s.tenant.admin.id, (q) =>
      q("update public.service_assignments set revoked_at = now() where service_request_id = $1", [s.requestId]),
    );
    expect(
      (await asUser(s.technician.id, (q) => q("select id from public.service_requests where id = $1", [s.requestId])))
        .rowCount,
    ).toBe(0);
    expect(await rejection(asUser(s.technician.id, (q) => propose(q, s.requestId)))).toMatch(/TM_NOT_FOUND/);
    expect(
      await rejection(
        asUser(s.tenant.admin.id, (q) =>
          q("update public.service_assignments set revoked_at = null where service_request_id = $1", [s.requestId]),
        ),
      ),
    ).toMatch(/TM_INVITATION_CLOSED/);

    await asUser(s.tenant.manager.id, (q) => transition(q, s.requestId, 1, "preklicano", "Ni več potrebno"));
    expect(
      await rejection(
        asUser(s.tenant.admin.id, (q) =>
          q(
            "insert into public.invitations (organization_id, kind, email, service_request_id, token_hash) values ($1, 'service_assignment', 'x@example.test', $2, $3)",
            [s.tenant.organizationId, s.requestId, newToken().hash],
          ),
        ),
      ),
    ).toMatch(/TM_REQUEST_CLOSED/);
  });
});

describe("messages", () => {
  it("separates shared and internal messages", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    const insert = (userId: string, visibility: string, body: string) =>
      asUser(userId, (q) =>
        q<{ author_id: string }>(
          "insert into public.service_messages (organization_id, service_request_id, visibility, body) values ($1, $2, $3, $4) returning author_id",
          [s.tenant.organizationId, s.requestId, visibility, body],
        ),
      );
    expect((await insert(s.technician.id, "shared", "  Pridem v torek. ")).rows[0]!.author_id).toBe(s.technician.id);
    await insert(s.tenant.manager.id, "internal", "Interna opomba");
    await insert(s.tenant.manager.id, "shared", "Potrjujem.");
    expect(await rejection(insert(s.technician.id, "internal", "Skrito"))).toMatch(/row-level security/);
    expect(await rejection(insert(s.tenant.viewer.id, "shared", "Pregledovalec"))).toMatch(/row-level security/);

    const techView = await asUser(s.technician.id, (q) =>
      q<{ body: string }>("select body from public.service_messages order by created_at"),
    );
    expect(techView.rows.map((r) => r.body)).toEqual(["Pridem v torek.", "Potrjujem."]);
    const viewerView = await asUser(s.tenant.viewer.id, (q) => q("select body from public.service_messages"));
    expect(viewerView.rowCount).toBe(3);
    expect(
      await rejection(
        asUser(s.tenant.owner.id, (q) =>
          q("delete from public.service_messages where service_request_id = $1", [s.requestId]),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("appointments", () => {
  it("lets the technician propose and the organization confirm", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    expect(await rejection(asUser(s.tenant.viewer.id, (q) => propose(q, s.requestId)))).toMatch(/TM_FORBIDDEN/);
    expect(await rejection(asUser(s.technician.id, (q) => propose(q, s.requestId, -2)))).toMatch(
      /TM_APPOINTMENT_INVALID/,
    );

    const first = await asUser(s.technician.id, (q) => propose(q, s.requestId, 24));
    const second = await asUser(s.technician.id, (q) => propose(q, s.requestId, 72));
    expect((await request(s.requestId)).status).toBe("v_usklajevanju");
    expect(
      await rejection(asUser(s.technician.id, (q) => q("select public.respond_appointment($1, 'accept')", [first]))),
    ).toMatch(/TM_FORBIDDEN/);
    await asUser(s.tenant.manager.id, (q) => q("select public.respond_appointment($1, 'accept')", [second]));

    const state = await request(s.requestId);
    expect(state.status).toBe("termin_potrjen");
    expect(state.scheduled_start).not.toBeNull();
    const proposals = await asUser(s.technician.id, (q) =>
      q<{ id: string; status: string }>("select id, status from public.appointment_proposals order by created_at"),
    );
    expect(proposals.rows).toEqual([
      { id: first, status: "superseded" },
      { id: second, status: "accepted" },
    ]);
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) => q("select public.respond_appointment($1, 'accept')", [first])),
      ),
    ).toMatch(/TM_PROPOSAL_CLOSED/);
  });

  it("lets the technician accept a proposal made by the organization and the proposer withdraw", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    const mine = await asUser(s.tenant.manager.id, (q) => propose(q, s.requestId));
    const withdrawn = await asUser(s.tenant.admin.id, (q) => propose(q, s.requestId, 96));
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) => q("select public.respond_appointment($1, 'withdraw')", [withdrawn])),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    await asUser(s.tenant.admin.id, (q) => q("select public.respond_appointment($1, 'withdraw')", [withdrawn]));
    await asUser(s.technician.id, (q) => q("select public.respond_appointment($1, 'accept')", [mine]));
    expect((await request(s.requestId)).status).toBe("termin_potrjen");
  });
});

describe("completion records", () => {
  it("requires acknowledgment of an external completion before the plan advances", async () => {
    const s = await setup({ plan: true });
    await assign(s.tenant, s.requestId, s.technician.id);
    expect(await nextDue(s.planId!)).toBe("2026-01-15");
    await confirmAppointment(s);
    await asUser(s.technician.id, async (q) => transition(q, s.requestId, await version(s.requestId), "v_izvedbi"));
    expect(
      await rejection(asUser(s.technician.id, (q) => record(q, s.requestId, "completed", null, "2999-01-01"))),
    ).toMatch(/TM_COMPLETION_DATE_INVALID/);
    const completion = await asUser(s.technician.id, (q) => record(q, s.requestId));

    expect((await request(s.requestId)).status).toBe("caka_na_potrditev");
    expect(await nextDue(s.planId!)).toBe("2026-01-15");
    expect(await rejection(asUser(s.technician.id, (q) => record(q, s.requestId)))).toMatch(
      /TM_TRANSITION_NOT_ALLOWED/,
    );
    expect(
      await rejection(
        asUser(s.technician.id, (q) => q("select public.acknowledge_completion($1, true)", [completion])),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    expect(
      await rejection(
        asUser(s.tenant.viewer.id, (q) => q("select public.acknowledge_completion($1, true)", [completion])),
      ),
    ).toMatch(/TM_FORBIDDEN/);

    await asUser(s.tenant.manager.id, (q) => q("select public.acknowledge_completion($1, true)", [completion]));
    const state = await request(s.requestId);
    expect(state.status).toBe("zakljuceno");
    expect(state.closed_at).not.toBeNull();
    expect(await nextDue(s.planId!)).toBe("2027-11-01");
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) =>
          q("update public.service_requests set title = 'X' where id = $1", [s.requestId]),
        ),
      ),
    ).toMatch(/TM_REQUEST_CLOSED/);
  });

  it("returns a rejected completion to the technician", async () => {
    const s = await setup({ plan: true });
    await assign(s.tenant, s.requestId, s.technician.id);
    await confirmAppointment(s);
    const completion = await asUser(s.technician.id, (q) => record(q, s.requestId));
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) => q("select public.acknowledge_completion($1, false)", [completion])),
      ),
    ).toMatch(/TM_REASON_REQUIRED/);
    await asUser(s.tenant.manager.id, (q) =>
      q("select public.acknowledge_completion($1, false, 'Manjka poročilo')", [completion]),
    );
    expect((await request(s.requestId)).status).toBe("v_izvedbi");
    expect(await nextDue(s.planId!)).toBe("2026-01-15");
    await asUser(s.technician.id, (q) => record(q, s.requestId));
    expect((await request(s.requestId)).status).toBe("caka_na_potrditev");
  });

  it("applies operator-recorded completions immediately and blocks closing with open replacement equipment", async () => {
    const s = await setup({ plan: true });
    await asUser(s.tenant.manager.id, async (q) => {
      await q("select public.set_replacement_status($1, $2, 'requested')", [
        s.requestId,
        await versionIn(q, s.requestId),
      ]);
      await record(q, s.requestId);
    });
    expect(await nextDue(s.planId!)).toBe("2027-11-01");
    expect((await request(s.requestId)).status).toBe("v_izvedbi");
    expect(
      await rejection(
        asUser(s.tenant.manager.id, async (q) => transition(q, s.requestId, await version(s.requestId), "zakljuceno")),
      ),
    ).toMatch(/TM_REPLACEMENT_OPEN/);
    await asUser(s.tenant.manager.id, async (q) => {
      for (const next of ["arranged", "delivered", "returned"]) {
        await q("select public.set_replacement_status($1, $2, $3)", [
          s.requestId,
          await versionIn(q, s.requestId),
          next,
        ]);
      }
    });
    expect(
      await rejection(
        asUser(s.tenant.manager.id, async (q) =>
          q("select public.set_replacement_status($1, $2, 'requested')", [s.requestId, await version(s.requestId)]),
        ),
      ),
    ).toMatch(/TM_TRANSITION_NOT_ALLOWED/);
    await asUser(s.tenant.manager.id, async (q) =>
      transition(q, s.requestId, await version(s.requestId), "zakljuceno"),
    );
    expect((await request(s.requestId)).status).toBe("zakljuceno");
  });

  it("keeps voided records, reopens the request, recomputes the plan and accepts a correction", async () => {
    const s = await setup({ plan: true });
    const first = await asUser(s.tenant.manager.id, async (q) => {
      const id = await record(q, s.requestId);
      await transition(q, s.requestId, await versionIn(q, s.requestId), "zakljuceno");
      return id;
    });
    expect(await nextDue(s.planId!)).toBe("2027-11-01");
    expect(
      await rejection(
        asUser(s.tenant.manager.id, (q) => q("select public.void_completion($1, 'Napačen datum')", [first])),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    expect(
      await rejection(asUser(s.tenant.admin.id, (q) => q("select public.void_completion($1, '')", [first]))),
    ).toMatch(/TM_REASON_REQUIRED/);
    await asUser(s.tenant.admin.id, (q) => q("select public.void_completion($1, 'Napačen datum')", [first]));
    expect((await request(s.requestId)).status).toBe("v_izvedbi");
    expect(await nextDue(s.planId!)).toBe("2026-01-15");

    const other = await setup();
    const foreign = await asUser(other.tenant.manager.id, (q) => record(q, other.requestId));
    expect(await rejection(asUser(s.tenant.manager.id, (q) => record(q, s.requestId, "completed", foreign)))).toMatch(
      /TM_INVALID_REPLACEMENT/,
    );
    await asUser(s.tenant.manager.id, (q) => record(q, s.requestId, "completed", first, "2026-10-20"));
    expect(await nextDue(s.planId!)).toBe("2027-10-20");
    const history = await asUser(s.tenant.viewer.id, (q) =>
      q<{ voided: boolean; replaces_id: string | null }>(
        "select voided_at is not null as voided, replaces_id from public.completion_records where service_request_id = $1 order by created_at",
        [s.requestId],
      ),
    );
    expect(history.rows).toEqual([
      { voided: true, replaces_id: null },
      { voided: false, replaces_id: first },
    ]);
    expect(
      await rejection(asUser(s.tenant.admin.id, (q) => q("select public.void_completion($1, 'Ponovno')", [first]))),
    ).toMatch(/TM_ALREADY_VOIDED/);
  });

  it("treats 'not completed' reports as information that neither advances the plan nor blocks a new record", async () => {
    const s = await setup({ plan: true });
    await asUser(s.tenant.manager.id, async (q) => {
      await record(q, s.requestId, "not_completed");
      await record(q, s.requestId, "completed");
    });
    expect(await nextDue(s.planId!)).toBe("2027-11-01");
    expect(await rejection(asUser(s.tenant.manager.id, (q) => record(q, s.requestId)))).toMatch(/TM_COMPLETION_EXISTS/);
  });

  it("shows the shared timeline to the technician but keeps clients from writing records directly", async () => {
    const s = await setup();
    await assign(s.tenant, s.requestId, s.technician.id);
    await confirmAppointment(s);
    const events = await asUser(s.technician.id, (q) =>
      q<{ event_type: string }>(
        "select event_type from public.service_events where service_request_id = $1 order by id",
        [s.requestId],
      ),
    );
    expect(events.rows.map((e) => e.event_type)).toEqual([
      "created",
      "assignee_added",
      "status_changed",
      "appointment_proposed",
      "appointment_accepted",
      "status_changed",
    ]);
    for (const sql of [
      "insert into public.completion_records (organization_id, service_request_id, equipment_id, completed_on, outcome, summary, recorded_as, acknowledgment_status) values ($1, $2, $3, '2026-01-01', 'completed', 'xxx', 'member', 'not_required')",
      "insert into public.service_events (organization_id, service_request_id, event_type) values ($1, $2, 'x')",
      "insert into public.appointment_proposals (organization_id, service_request_id, proposed_as, starts_at, ends_at) values ($1, $2, 'member', now(), now() + interval '1 hour')",
    ]) {
      expect(
        await rejection(
          asUser(s.tenant.owner.id, (q) =>
            q(sql, [s.tenant.organizationId, s.requestId, s.equipmentId].slice(0, (sql.match(/\$/g) ?? []).length)),
          ),
        ),
      ).toMatch(/permission denied/);
    }
  });
});
