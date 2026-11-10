import { afterAll, describe, expect, it } from "vitest";
import { admin, asService, asUser, createAuthUser, newToken, pool, rejection, uniqueEmail } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("operator bootstrap", () => {
  it("creates the organization and an owner invitation; rerun replaces the pending invitation", async () => {
    const name = `Bolnišnica ${Date.now()}`;
    const email = uniqueEmail("first-owner");
    const first = newToken();
    const created = await asService((q) =>
      q("select * from public.bootstrap_organization($1, 'healthcare_provider', $2, $3)", [name, email, first.hash]),
    );
    expect(created.rows[0]!.status).toBe("invitation_created");
    const organizationId = created.rows[0]!.organization_id as string;

    const second = newToken();
    const rerun = await asService((q) =>
      q("select * from public.bootstrap_organization($1, 'healthcare_provider', $2, $3)", [name, email, second.hash]),
    );
    expect(rerun.rows[0]).toMatchObject({ organization_id: organizationId, status: "invitation_created" });

    const { rows } = await admin(
      "select token_hash, revoked_at is not null as revoked from public.invitations where organization_id = $1 order by created_at",
      [organizationId],
    );
    expect(rows.map((r) => r.revoked)).toEqual([true, false]);

    const owner = await createAuthUser({ email });
    const oldLink = await rejection(
      asUser(owner.id, (q) => q("select * from public.accept_invitation($1)", [first.hash])),
    );
    expect(oldLink).toContain("TM_INVITATION_REVOKED");
    await asUser(owner.id, (q) => q("select * from public.accept_invitation($1)", [second.hash]));
    const membership = await admin("select role from public.organization_memberships where organization_id = $1", [
      organizationId,
    ]);
    expect(membership.rows[0]!.role).toBe("owner");

    const done = await asService((q) =>
      q("select * from public.bootstrap_organization($1, 'healthcare_provider', $2, $3)", [
        name,
        email,
        newToken().hash,
      ]),
    );
    expect(done.rows[0]!.status).toBe("already_owner");
  });

  it("refuses a kind mismatch and is not callable by application users", async () => {
    const name = `Serviser ${Date.now()}`;
    await asService((q) =>
      q("select * from public.bootstrap_organization($1, 'service_provider', $2, $3)", [
        name,
        uniqueEmail(),
        newToken().hash,
      ]),
    );
    const mismatch = await rejection(
      asService((q) =>
        q("select * from public.bootstrap_organization($1, 'distributor', $2, $3)", [
          name,
          uniqueEmail(),
          newToken().hash,
        ]),
      ),
    );
    expect(mismatch).toContain("TM_BOOTSTRAP_KIND_MISMATCH");

    const user = await createAuthUser();
    const denied = await rejection(
      asUser(user.id, (q) =>
        q("select * from public.bootstrap_organization('X Org', 'distributor', $1, $2)", [
          uniqueEmail(),
          newToken().hash,
        ]),
      ),
    );
    expect(denied).toContain("permission denied");
  });
});
