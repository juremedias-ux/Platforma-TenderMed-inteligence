import { afterAll, describe, expect, it } from "vitest";
import { admin, asService, asUser, createAuthUser, createTenant, pool, rejection, type Query } from "./helpers";

afterAll(async () => {
  await pool.end();
});

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function equipmentFor(tenant: Tenant) {
  const { rows } = await admin<{ id: string }>(
    "insert into public.equipment (organization_id, name, category) values ($1, 'Ultrazvok', 'ultrasound_imaging') returning id",
    [tenant.organizationId],
  );
  return rows[0]!.id;
}

async function requestFor(tenant: Tenant, equipmentId: string) {
  const { rows } = await admin<{ id: string }>(
    "insert into public.service_requests (organization_id, equipment_id, request_type, title, reference_number) values ($1, $2, 'repair', 'Popravilo', 1) returning id",
    [tenant.organizationId, equipmentId],
  );
  return rows[0]!.id;
}

const createPending = (
  q: Query,
  org: string,
  options: { equipment?: string | null; request?: string | null; shared?: boolean; title?: string } = {},
) =>
  q<{ document_id: string; storage_path: string }>(
    "select * from public.create_pending_document($1, $2, $3, 'service_report', $4, 'porocilo.pdf', 'application/pdf', 1000, $5)",
    [
      org,
      options.equipment ?? null,
      options.request ?? null,
      options.title ?? "Servisno poročilo",
      options.shared ?? false,
    ],
  ).then((r) => r.rows[0]!);

const finalize = (id: string, ok = true) => asService((q) => q("select public.finalize_document($1, $2)", [id, ok]));

const storeObject = (path: string) =>
  admin("insert into storage.objects (bucket_id, name) values ('documents', $1)", [path]);

describe("documents", () => {
  it("creates pending documents at a fixed path and only for authorized callers", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const equipmentId = await equipmentFor(tenant);
    const doc = await asUser(tenant.manager.id, (q) =>
      createPending(q, tenant.organizationId, { equipment: equipmentId }),
    );
    expect(doc.storage_path).toBe(`${tenant.organizationId}/${doc.document_id}`);

    expect(
      await rejection(
        asUser(tenant.viewer.id, (q) => createPending(q, tenant.organizationId, { equipment: equipmentId })),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    expect(
      await rejection(
        asUser(other.owner.id, (q) => createPending(q, tenant.organizationId, { equipment: equipmentId })),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    expect(
      await rejection(
        asUser(other.owner.id, (q) => createPending(q, other.organizationId, { equipment: equipmentId })),
      ),
    ).toMatch(/TM_NOT_FOUND/);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q(
            "insert into public.documents (organization_id, document_type, title, file_name, mime_type, size_bytes, storage_path, uploaded_as) values ($1, 'other', 'X dokument', 'x.pdf', 'application/pdf', 1, 'x', 'member')",
            [tenant.organizationId],
          ),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("shows pending documents only to the uploader and ready documents to members", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    const doc = await asUser(tenant.manager.id, (q) => createPending(q, tenant.organizationId));
    const visible = (userId: string) =>
      asUser(userId, (q) => q("select id from public.documents where id = $1", [doc.document_id])).then(
        (r) => r.rowCount,
      );
    expect(await visible(tenant.manager.id)).toBe(1);
    expect(await visible(tenant.viewer.id)).toBe(0);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) => q("select public.finalize_document($1, true)", [doc.document_id])),
      ),
    ).toMatch(/permission denied/);
    await finalize(doc.document_id);
    expect(await visible(tenant.viewer.id)).toBe(1);
    expect(await visible(outsider.id)).toBe(0);
    expect(await rejection(finalize(doc.document_id))).toMatch(/TM_DOCUMENT_NOT_PENDING/);
  });

  it("allows storage reads only for ready documents the caller can read, and no client writes", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    const ready = await asUser(tenant.manager.id, (q) =>
      createPending(q, tenant.organizationId, { title: "Pripravljen" }),
    );
    const pending = await asUser(tenant.manager.id, (q) => createPending(q, tenant.organizationId, { title: "Čaka" }));
    await finalize(ready.document_id);
    await storeObject(ready.storage_path);
    await storeObject(pending.storage_path);

    const names = (userId: string) =>
      asUser(userId, (q) =>
        q<{ name: string }>("select name from storage.objects where bucket_id = 'documents' and name like $1", [
          `${tenant.organizationId}/%`,
        ]),
      ).then((r) => r.rows.map((row) => row.name));
    expect(await names(tenant.viewer.id)).toEqual([ready.storage_path]);
    expect(await names(tenant.manager.id)).toEqual([ready.storage_path]);
    expect(await names(outsider.id)).toEqual([]);

    expect(
      await rejection(
        asUser(tenant.owner.id, (q) =>
          q("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${tenant.organizationId}/x`]),
        ),
      ),
    ).toMatch(/row-level security/);
    const deleted = await asUser(tenant.owner.id, (q) =>
      q("delete from storage.objects where name = $1", [ready.storage_path]),
    );
    expect(deleted.rowCount).toBe(0);
  });

  it("shares request documents with assignees only when marked, and forces sharing for assignee uploads", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const technician = await createAuthUser();
    const equipmentId = await equipmentFor(tenant);
    const requestId = await requestFor(tenant, equipmentId);
    await admin(
      "insert into public.service_assignments (organization_id, service_request_id, assignee_user_id) values ($1, $2, $3)",
      [tenant.organizationId, requestId, technician.id],
    );

    const internal = await asUser(tenant.manager.id, (q) =>
      createPending(q, tenant.organizationId, { request: requestId, title: "Interno" }),
    );
    const shared = await asUser(tenant.manager.id, (q) =>
      createPending(q, tenant.organizationId, { request: requestId, shared: true, title: "Navodila" }),
    );
    const report = await asUser(technician.id, (q) =>
      createPending(q, tenant.organizationId, { request: requestId, shared: false, title: "Poročilo" }),
    );
    for (const doc of [internal, shared, report]) await finalize(doc.document_id);

    const techDocs = await asUser(technician.id, (q) =>
      q<{ title: string; uploaded_as: string; equipment_id: string }>(
        "select title, uploaded_as, equipment_id from public.documents order by title",
      ),
    );
    expect(techDocs.rows.map((r) => r.title)).toEqual(["Navodila", "Poročilo"]);
    expect(techDocs.rows[1]).toMatchObject({ uploaded_as: "assignee", equipment_id: equipmentId });

    expect(
      await rejection(
        asUser(technician.id, (q) => createPending(q, tenant.organizationId, { equipment: equipmentId })),
      ),
    ).toMatch(/TM_FORBIDDEN/);
    expect(
      await rejection(asUser(other.owner.id, (q) => createPending(q, other.organizationId, { request: requestId }))),
    ).toMatch(/TM_NOT_FOUND/);
  });

  it("lets operators edit metadata of ready documents only", async () => {
    const tenant = await createTenant();
    const equipmentId = await equipmentFor(tenant);
    const doc = await asUser(tenant.manager.id, (q) =>
      createPending(q, tenant.organizationId, { equipment: equipmentId }),
    );
    const rename = (userId: string) =>
      asUser(userId, (q) => q("update public.documents set title = 'Novo ime' where id = $1", [doc.document_id]));
    expect(await rejection(rename(tenant.manager.id))).toMatch(/TM_DOCUMENT_NOT_READY/);
    await finalize(doc.document_id);
    expect((await rename(tenant.viewer.id)).rowCount).toBe(0);
    expect((await rename(tenant.manager.id)).rowCount).toBe(1);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q("update public.documents set shared_with_assignees = true where id = $1", [doc.document_id]),
        ),
      ),
    ).toMatch(/row-level security|documents_sharing_chk/);
    expect(
      await rejection(
        asUser(tenant.manager.id, (q) =>
          q("update public.documents set storage_path = 'x' where id = $1", [doc.document_id]),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("expires stale pending uploads and limits pending uploads per user", async () => {
    const tenant = await createTenant();
    const stale = await asUser(tenant.manager.id, (q) => createPending(q, tenant.organizationId));
    // created_at is protected by a trigger; bypass triggers for this fixture only.
    const client = await pool.connect();
    try {
      await client.query("set session_replication_role = replica");
      await client.query("update public.documents set created_at = now() - interval '2 days' where id = $1", [
        stale.document_id,
      ]);
    } finally {
      await client.query("set session_replication_role = origin");
      client.release();
    }
    const expired = await asService((q) =>
      q<{ storage_path: string }>("select * from public.expire_pending_documents(interval '1 day')"),
    );
    expect(expired.rows.map((r) => r.storage_path)).toContain(stale.storage_path);

    await asUser(tenant.admin.id, async (q) => {
      for (let i = 0; i < 20; i += 1) await createPending(q, tenant.organizationId, { title: `Dokument ${i}` });
    });
    expect(await rejection(asUser(tenant.admin.id, (q) => createPending(q, tenant.organizationId)))).toMatch(
      /TM_TOO_MANY_PENDING/,
    );
  });

  it("keeps plan source documents inside the organization", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const equipmentA = await equipmentFor(a);
    const docB = await asUser(b.manager.id, (q) => createPending(q, b.organizationId));
    await finalize(docB.document_id);
    expect(
      await rejection(
        asUser(a.manager.id, (q) =>
          q(
            `insert into public.maintenance_plans (organization_id, equipment_id, activity_type, schedule_mode, due_date, source_basis, source_document_id)
             values ($1, $2, 'inspection', 'one_off', '2026-12-01', 'manufacturer_instructions', $3)`,
            [a.organizationId, equipmentA, docB.document_id],
          ),
        ),
      ),
    ).toMatch(/foreign key/);
  });
});
