import { afterAll, describe, expect, it } from "vitest";
import { admin, asService, asUser, createAuthUser, createTenant, pool, rejection, type Query } from "./helpers";

afterAll(async () => {
  await pool.end();
});

type Tenant = Awaited<ReturnType<typeof createTenant>>;

async function approvedSupplier(kind = "distributor", relationship = "none_declared") {
  const supplier = await createTenant(kind);
  await asService((q) =>
    q(
      "insert into public.supplier_approvals (organization_id, status, commercial_relationship) values ($1, 'approved', $2)",
      [supplier.organizationId, relationship],
    ),
  );
  return supplier;
}

const insertProduct = (q: Query, supplier: Tenant, status = "draft", name = "Senzor SpO2") =>
  q<{ id: string; published_at: Date | null }>(
    `insert into public.catalog_products (supplier_organization_id, name, product_type, category, manufacturer_name, model, status)
     values ($1, $2, 'accessory', 'patient_monitoring', 'Acme', 'VM-200', $3) returning id, published_at`,
    [supplier.organizationId, name, status],
  ).then((r) => r.rows[0]!);

const visibleProducts = (userId: string, supplierId?: string) =>
  asUser(userId, (q) =>
    q<{ name: string }>(
      "select name from public.catalog_products where $1::uuid is null or supplier_organization_id = $1 order by name",
      [supplierId ?? null],
    ),
  ).then((r) => r.rows.map((row) => row.name));

describe("catalog products", () => {
  it("lets only owners and admins of approved supplier organizations publish", async () => {
    const unapproved = await createTenant("distributor");
    expect(await rejection(asUser(unapproved.owner.id, (q) => insertProduct(q, unapproved)))).toMatch(
      /row-level security/,
    );

    const clinic = await createTenant("healthcare_provider");
    await asService((q) =>
      q("insert into public.supplier_approvals (organization_id, status) values ($1, 'approved')", [
        clinic.organizationId,
      ]),
    );
    expect(await rejection(asUser(clinic.owner.id, (q) => insertProduct(q, clinic)))).toMatch(/row-level security/);

    const supplier = await approvedSupplier();
    expect(await rejection(asUser(supplier.manager.id, (q) => insertProduct(q, supplier)))).toMatch(
      /row-level security/,
    );
    const product = await asUser(supplier.admin.id, (q) => insertProduct(q, supplier, "published"));
    expect(product.published_at).not.toBeNull();
    expect(
      await rejection(
        asUser(supplier.owner.id, (q) =>
          q("insert into public.supplier_approvals (organization_id) values ($1)", [supplier.organizationId]),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("shows drafts only to the supplier and published products only from approved suppliers", async () => {
    const supplier = await approvedSupplier();
    const clinic = await createTenant();
    const loner = await createAuthUser();
    await asUser(supplier.owner.id, async (q) => {
      await insertProduct(q, supplier, "draft", "Osnutek");
      await insertProduct(q, supplier, "published", "Objavljen");
    });
    expect(await visibleProducts(supplier.viewer.id, supplier.organizationId)).toEqual(["Objavljen", "Osnutek"]);
    expect(await visibleProducts(clinic.viewer.id, supplier.organizationId)).toEqual(["Objavljen"]);
    expect(await visibleProducts(loner.id)).toEqual([]);

    await asService((q) =>
      q("update public.supplier_approvals set status = 'suspended' where organization_id = $1", [
        supplier.organizationId,
      ]),
    );
    expect(await visibleProducts(clinic.viewer.id, supplier.organizationId)).toEqual([]);
    expect(await rejection(asUser(supplier.owner.id, (q) => insertProduct(q, supplier)))).toMatch(/row-level security/);
  });

  it("restricts compatibility and sources to the supplier and requires https sources", async () => {
    const supplier = await approvedSupplier();
    const clinic = await createTenant();
    const product = await asUser(supplier.owner.id, (q) => insertProduct(q, supplier, "published"));
    await asUser(supplier.owner.id, (q) =>
      q(
        "insert into public.catalog_compatibility (supplier_organization_id, product_id, manufacturer_name, model) values ($1, $2, 'Acme', 'VM-200')",
        [supplier.organizationId, product.id],
      ),
    );
    expect(
      await rejection(
        asUser(supplier.owner.id, (q) =>
          q(
            "insert into public.catalog_sources (supplier_organization_id, product_id, title, url) values ($1, $2, 'Tehnični list', 'http://example.com/x.pdf')",
            [supplier.organizationId, product.id],
          ),
        ),
      ),
    ).toMatch(/catalog_sources_url_chk/);
    expect(
      await rejection(
        asUser(clinic.owner.id, (q) =>
          q(
            "insert into public.catalog_compatibility (supplier_organization_id, product_id, manufacturer_name, model) values ($1, $2, 'X', 'Y')",
            [supplier.organizationId, product.id],
          ),
        ),
      ),
    ).toMatch(/row-level security/);
    const seen = await asUser(clinic.viewer.id, (q) => q("select model from public.catalog_compatibility"));
    expect(seen.rows).toEqual([{ model: "VM-200" }]);
    const suppliers = await asUser(clinic.viewer.id, (q) =>
      q<{ organization_id: string }>("select organization_id from public.catalog_suppliers()"),
    );
    expect(suppliers.rows.map((r) => r.organization_id)).toContain(supplier.organizationId);
  });
});

describe("organization notes and feedback", () => {
  it("keeps private notes and feedback inside the organization", async () => {
    const supplier = await approvedSupplier();
    const clinic = await createTenant();
    const other = await createTenant();
    const product = await asUser(supplier.owner.id, (q) => insertProduct(q, supplier, "published"));
    await asUser(clinic.manager.id, async (q) => {
      await q(
        "insert into public.catalog_private_notes (organization_id, product_id, body) values ($1, $2, 'Cena ok')",
        [clinic.organizationId, product.id],
      );
      await q(
        "insert into public.recommendation_feedback (organization_id, product_id, rule_key, status) values ($1, $2, 'compatible:abc', 'saved')",
        [clinic.organizationId, product.id],
      );
    });
    expect((await asUser(clinic.viewer.id, (q) => q("select body from public.catalog_private_notes"))).rows).toEqual([
      { body: "Cena ok" },
    ]);
    expect((await asUser(other.owner.id, (q) => q("select body from public.catalog_private_notes"))).rowCount).toBe(0);
    expect(
      (await asUser(supplier.owner.id, (q) => q("select status from public.recommendation_feedback"))).rowCount,
    ).toBe(0);
    expect(
      await rejection(
        asUser(clinic.viewer.id, (q) =>
          q("insert into public.catalog_private_notes (organization_id, product_id, body) values ($1, $2, 'x')", [
            clinic.organizationId,
            product.id,
          ]),
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await rejection(
        asUser(clinic.manager.id, (q) =>
          q(
            "insert into public.recommendation_feedback (organization_id, product_id, rule_key, status) values ($1, $2, 'bad key!', 'saved')",
            [clinic.organizationId, product.id],
          ),
        ),
      ),
    ).toMatch(/recommendation_feedback_rule_chk/);
  });
});

describe("supplier inquiries", () => {
  it("sends an explicit snapshot to the supplier, who answers; the requester can only close", async () => {
    const supplier = await approvedSupplier();
    const clinic = await createTenant();
    const outsider = await createTenant();
    const product = await asUser(supplier.owner.id, (q) => insertProduct(q, supplier, "published"));
    const draft = await asUser(supplier.owner.id, (q) => insertProduct(q, supplier, "draft", "Osnutek"));
    const send = (productId: string) =>
      asUser(clinic.manager.id, (q) =>
        q<{ id: string; created_by: string; status: string }>(
          `insert into public.supplier_inquiries (organization_id, supplier_organization_id, product_id, message, shared_snapshot)
           values ($1, $2, $3, 'Prosimo za ponudbo.', $4) returning id, created_by, status`,
          [
            clinic.organizationId,
            supplier.organizationId,
            productId,
            JSON.stringify({ equipment: [{ model: "VM-200" }] }),
          ],
        ),
      );
    expect(await rejection(send(draft.id))).toMatch(/TM_PRODUCT_NOT_AVAILABLE/);
    const inquiry = (await send(product.id)).rows[0]!;
    expect(inquiry).toMatchObject({ created_by: clinic.manager.id, status: "sent" });

    const supplierNotes = await asUser(supplier.admin.id, (q) =>
      q<{ title: string }>("select title from public.notifications where kind = 'supplier_inquiry'"),
    );
    expect(supplierNotes.rows.map((r) => r.title)).toEqual(["Novo povpraševanje: Senzor SpO2"]);
    expect((await asUser(outsider.owner.id, (q) => q("select id from public.supplier_inquiries"))).rowCount).toBe(0);

    const answer = (userId: string) =>
      asUser(userId, (q) =>
        q(
          "update public.supplier_inquiries set status = 'answered', response_text = 'Ponudba v prilogi.' where id = $1",
          [inquiry.id],
        ),
      );
    expect((await answer(supplier.manager.id)).rowCount).toBe(0);
    expect(await rejection(answer(clinic.manager.id))).toMatch(/TM_TRANSITION_NOT_ALLOWED/);
    expect((await answer(supplier.admin.id)).rowCount).toBe(1);
    const requesterNotes = await asUser(clinic.manager.id, (q) =>
      q<{ title: string }>("select title from public.notifications where kind = 'supplier_inquiry'"),
    );
    expect(requesterNotes.rows.map((r) => r.title)).toEqual(["Odgovor na povpraševanje: Senzor SpO2"]);
    await asUser(clinic.manager.id, (q) =>
      q("update public.supplier_inquiries set status = 'closed' where id = $1", [inquiry.id]),
    );
    expect(
      await rejection(
        asUser(supplier.admin.id, (q) =>
          q("update public.supplier_inquiries set response_text = 'Nov odgovor' where id = $1", [inquiry.id]),
        ),
      ),
    ).toMatch(/TM_TRANSITION_NOT_ALLOWED/);
    const audit = await admin<{ organization_id: string }>(
      "select organization_id from public.audit_events where entity_id = $1 and action = 'insert'",
      [inquiry.id],
    );
    expect(audit.rows.map((r) => r.organization_id).sort()).toEqual(
      [clinic.organizationId, supplier.organizationId].sort(),
    );
  });
});

describe("save_catalog_product", () => {
  it("saves a product with compatibility and sources atomically and checks versions", async () => {
    const supplier = await approvedSupplier();
    const clinic = await createTenant();
    const save = (
      userId: string,
      productId: string | null,
      version: number | null,
      compat: unknown[],
      sources: unknown[],
    ) =>
      asUser(userId, (q) =>
        q<{ id: string }>("select public.save_catalog_product($1, $2, $3, $4, $5, $6) as id", [
          supplier.organizationId,
          productId,
          version,
          JSON.stringify({ name: "Elektrode EKG", product_type: "consumable", category: "ecg", model: "" }),
          JSON.stringify(compat),
          JSON.stringify(sources),
        ]),
      ).then((r) => r.rows[0]!.id);
    const id = await save(
      supplier.admin.id,
      null,
      null,
      [
        { manufacturer_name: "Acme", model: "E1" },
        { manufacturer_name: "acme", model: "e1" },
      ],
      [{ title: "Tehnični list", url: "https://example.com/e.pdf", retrieved_on: "2026-11-01" }],
    );
    const compat = await admin("select model from public.catalog_compatibility where product_id = $1", [id]);
    expect(compat.rowCount).toBe(1);
    expect(await rejection(save(supplier.admin.id, id, 99, [], []))).toMatch(/TM_VERSION_CONFLICT/);
    expect(
      await rejection(save(supplier.admin.id, id, 1, [], [{ title: "Slab vir", url: "ftp://x", retrieved_on: "" }])),
    ).toMatch(/catalog_sources_url_chk/);
    expect((await admin("select id from public.catalog_compatibility where product_id = $1", [id])).rowCount).toBe(1);
    await save(supplier.admin.id, id, 1, [], []);
    expect((await admin("select id from public.catalog_sources where product_id = $1", [id])).rowCount).toBe(0);
    expect(await rejection(save(clinic.owner.id, null, null, [], []))).toMatch(/TM_FORBIDDEN/);
  });
});
