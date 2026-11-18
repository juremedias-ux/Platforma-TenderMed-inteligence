import { afterAll, describe, expect, it } from "vitest";
import {
  addMember,
  admin,
  asAnon,
  asService,
  asUser,
  createAuthUser,
  createOrganization,
  createTenant,
  newToken,
  pool,
  rejection,
  uniqueEmail,
} from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("anonymous and unrelated access", () => {
  it("anonymous clients cannot read tenant tables", async () => {
    await createTenant();
    for (const table of ["organizations", "organization_memberships", "invitations", "profiles", "audit_events"]) {
      const message = await rejection(asAnon((q) => q(`select * from public.${table}`)));
      expect(message, table).toContain("permission denied");
    }
  });

  it("an authenticated user without membership sees nothing", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    const rows = await asUser(outsider.id, async (q) => ({
      orgs: (await q("select id from public.organizations where id = $1", [tenant.organizationId])).rowCount,
      members: (
        await q("select user_id from public.organization_memberships where organization_id = $1", [
          tenant.organizationId,
        ])
      ).rowCount,
      profiles: (await q("select id from public.profiles where id = $1", [tenant.owner.id])).rowCount,
    }));
    expect(rows).toEqual({ orgs: 0, members: 0, profiles: 0 });
  });

  it("organization A members cannot read organization B", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const visible = await asUser(a.owner.id, async (q) =>
      (await q<{ id: string }>("select id from public.organizations")).rows.map((r) => r.id),
    );
    expect(visible).toContain(a.organizationId);
    expect(visible).not.toContain(b.organizationId);
  });

  it("membership policies do not recurse", async () => {
    const tenant = await createTenant();
    const count = await asUser(
      tenant.viewer.id,
      async (q) =>
        (await q("select * from public.organization_memberships where organization_id = $1", [tenant.organizationId]))
          .rowCount,
    );
    expect(count).toBe(4);
  });
});

describe("membership administration", () => {
  it("users cannot add memberships directly", async () => {
    const tenant = await createTenant();
    const outsider = await createAuthUser();
    const message = await rejection(
      asUser(tenant.owner.id, (q) =>
        q("insert into public.organization_memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [
          tenant.organizationId,
          outsider.id,
        ]),
      ),
    );
    expect(message).toContain("permission denied");
  });

  it("a viewer cannot change roles", async () => {
    const tenant = await createTenant();
    await asUser(tenant.viewer.id, (q) =>
      q("update public.organization_memberships set role = 'admin' where organization_id = $1 and user_id = $2", [
        tenant.organizationId,
        tenant.manager.id,
      ]),
    );
    const { rows } = await admin("select role from public.organization_memberships where user_id = $1", [
      tenant.manager.id,
    ]);
    expect(rows[0]!.role).toBe("equipment_manager");
  });

  it("nobody can change their own role (no self-promotion)", async () => {
    const tenant = await createTenant();
    const message = await rejection(
      asUser(tenant.admin.id, (q) =>
        q("update public.organization_memberships set role = 'owner' where organization_id = $1 and user_id = $2", [
          tenant.organizationId,
          tenant.admin.id,
        ]),
      ),
    );
    expect(message).toContain("TM_MEMBERSHIP_SELF_CHANGE");
  });

  it("admins cannot create or modify owners", async () => {
    const tenant = await createTenant();
    const promote = await rejection(
      asUser(tenant.admin.id, (q) =>
        q("update public.organization_memberships set role = 'owner' where organization_id = $1 and user_id = $2", [
          tenant.organizationId,
          tenant.manager.id,
        ]),
      ),
    );
    expect(promote).toContain("TM_MEMBERSHIP_OWNER_ONLY");
    const removeOwner = await rejection(
      asUser(tenant.admin.id, (q) =>
        q("delete from public.organization_memberships where organization_id = $1 and user_id = $2", [
          tenant.organizationId,
          tenant.owner.id,
        ]),
      ),
    );
    expect(removeOwner).toContain("TM_MEMBERSHIP_OWNER_ONLY");
  });

  it("admins can change non-owner roles", async () => {
    const tenant = await createTenant();
    await asUser(tenant.admin.id, (q) =>
      q("update public.organization_memberships set role = 'viewer' where organization_id = $1 and user_id = $2", [
        tenant.organizationId,
        tenant.manager.id,
      ]),
    );
    const { rows } = await admin("select role from public.organization_memberships where user_id = $1", [
      tenant.manager.id,
    ]);
    expect(rows[0]!.role).toBe("viewer");
  });

  it("the last owner can be neither removed nor demoted, not even by the service role", async () => {
    const tenant = await createTenant();
    const leave = await rejection(
      asUser(tenant.owner.id, (q) =>
        q("delete from public.organization_memberships where organization_id = $1 and user_id = $2", [
          tenant.organizationId,
          tenant.owner.id,
        ]),
      ),
    );
    expect(leave).toContain("TM_LAST_OWNER");
    const demote = await rejection(
      asService((q) =>
        q("update public.organization_memberships set role = 'admin' where organization_id = $1 and user_id = $2", [
          tenant.organizationId,
          tenant.owner.id,
        ]),
      ),
    );
    expect(demote).toContain("TM_LAST_OWNER");
  });

  it("an owner can hand over ownership when a second owner exists", async () => {
    const tenant = await createTenant();
    await asUser(tenant.owner.id, (q) =>
      q("update public.organization_memberships set role = 'owner' where organization_id = $1 and user_id = $2", [
        tenant.organizationId,
        tenant.admin.id,
      ]),
    );
    await asUser(tenant.admin.id, (q) =>
      q("delete from public.organization_memberships where organization_id = $1 and user_id = $2", [
        tenant.organizationId,
        tenant.owner.id,
      ]),
    );
    const { rows } = await admin("select role from public.organization_memberships where organization_id = $1", [
      tenant.organizationId,
    ]);
    expect(rows.filter((r) => r.role === "owner")).toHaveLength(1);
  });

  it("only owners can rename the organization", async () => {
    const tenant = await createTenant();
    await asUser(tenant.admin.id, (q) =>
      q("update public.organizations set name = 'Spremenjeno ime' where id = $1", [tenant.organizationId]),
    );
    let { rows } = await admin("select name from public.organizations where id = $1", [tenant.organizationId]);
    expect(rows[0]!.name).not.toBe("Spremenjeno ime");
    await asUser(tenant.owner.id, (q) =>
      q("update public.organizations set name = 'Spremenjeno ime' where id = $1", [tenant.organizationId]),
    );
    ({ rows } = await admin("select name from public.organizations where id = $1", [tenant.organizationId]));
    expect(rows[0]!.name).toBe("Spremenjeno ime");
  });

  it("organization kind cannot be changed by members", async () => {
    const tenant = await createTenant();
    const message = await rejection(
      asUser(tenant.owner.id, (q) =>
        q("update public.organizations set kind = 'distributor' where id = $1", [tenant.organizationId]),
      ),
    );
    expect(message).toContain("permission denied");
  });
});

async function invite(inviterId: string, organizationId: string, email: string, role: string) {
  const { token, hash } = newToken();
  await asUser(inviterId, (q) =>
    q(
      `insert into public.invitations (organization_id, kind, email, role, token_hash)
       values ($1, 'membership', $2, $3, $4)`,
      [organizationId, email, role, hash],
    ),
  );
  return { token, hash };
}

describe("invitations", () => {
  it("records the caller as inviter and blocks forged inviters", async () => {
    const tenant = await createTenant();
    const { hash } = newToken();
    await asUser(tenant.admin.id, (q) =>
      q(
        `insert into public.invitations (organization_id, kind, email, role, token_hash)
         values ($1, 'membership', $2, 'viewer', $3)`,
        [tenant.organizationId, uniqueEmail(), hash],
      ),
    );
    const { rows } = await admin("select created_by from public.invitations where token_hash = $1", [hash]);
    expect(rows[0]!.created_by).toBe(tenant.admin.id);
    const forged = await rejection(
      asUser(tenant.admin.id, (q) =>
        q(
          `insert into public.invitations (organization_id, kind, email, role, token_hash, created_by)
           values ($1, 'membership', $2, 'viewer', $3, $4)`,
          [tenant.organizationId, uniqueEmail(), newToken().hash, tenant.owner.id],
        ),
      ),
    );
    expect(forged).toContain("permission denied");
  });

  it("viewers and equipment managers cannot invite; admins cannot invite owners", async () => {
    const tenant = await createTenant();
    for (const user of [tenant.viewer, tenant.manager]) {
      const message = await rejection(invite(user.id, tenant.organizationId, uniqueEmail(), "viewer"));
      expect(message).toContain("row-level security");
    }
    const tooHigh = await rejection(invite(tenant.admin.id, tenant.organizationId, uniqueEmail(), "owner"));
    expect(tooHigh).toContain("TM_INVITATION_ROLE_TOO_HIGH");
  });

  it("members cannot invite into another organization", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const message = await rejection(invite(a.owner.id, b.organizationId, uniqueEmail(), "viewer"));
    // Rejected by the invitation trigger (no role in B) before RLS evaluates.
    expect(message).toMatch(/row-level security|TM_INVITATION_ROLE_TOO_HIGH/);
    const { rows } = await admin("select count(*)::int as n from public.invitations where organization_id = $1", [
      b.organizationId,
    ]);
    expect(rows[0]!.n).toBe(0);
  });

  it("previews by token for anonymous visitors and hides unknown tokens", async () => {
    const tenant = await createTenant();
    const email = uniqueEmail("invitee");
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, email, "equipment_manager");
    const preview = await asAnon((q) => q("select * from public.get_invitation_preview($1)", [hash]));
    expect(preview.rows[0]).toMatchObject({ email, role: "equipment_manager", status: "pending", kind: "membership" });
    const unknown = await asAnon((q) => q("select * from public.get_invitation_preview($1)", [newToken().hash]));
    expect(unknown.rowCount).toBe(0);
  });

  it("accepts once for the invited verified e-mail and rejects replay", async () => {
    const tenant = await createTenant();
    const invitee = await createAuthUser({ email: uniqueEmail("invitee") });
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, invitee.email, "equipment_manager");

    const accepted = await asUser(invitee.id, (q) => q("select * from public.accept_invitation($1)", [hash]));
    expect(accepted.rows[0]).toMatchObject({ organization_id: tenant.organizationId, kind: "membership" });
    const { rows } = await admin("select role from public.organization_memberships where user_id = $1", [invitee.id]);
    expect(rows[0]!.role).toBe("equipment_manager");

    const replay = await rejection(asUser(invitee.id, (q) => q("select * from public.accept_invitation($1)", [hash])));
    expect(replay).toContain("TM_INVITATION_USED");
  });

  it("rejects other e-mail addresses, unverified e-mail, expired and revoked invitations", async () => {
    const tenant = await createTenant();
    const intended = uniqueEmail("intended");
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, intended, "viewer");

    const other = await createAuthUser();
    expect(await rejection(asUser(other.id, (q) => q("select * from public.accept_invitation($1)", [hash])))).toContain(
      "TM_INVITATION_EMAIL_MISMATCH",
    );

    const unverified = await createAuthUser({ email: intended, confirmed: false });
    expect(
      await rejection(asUser(unverified.id, (q) => q("select * from public.accept_invitation($1)", [hash]))),
    ).toContain("TM_EMAIL_NOT_VERIFIED");

    const expiredTarget = await createAuthUser();
    const expired = newToken();
    await admin(
      `insert into public.invitations (organization_id, kind, email, role, token_hash, created_at, expires_at)
       values ($1, 'membership', $2, 'viewer', $3, now() - interval '8 days', now() - interval '1 day')`,
      [tenant.organizationId, expiredTarget.email, expired.hash],
    );
    expect(
      await rejection(asUser(expiredTarget.id, (q) => q("select * from public.accept_invitation($1)", [expired.hash]))),
    ).toContain("TM_INVITATION_EXPIRED");

    const revokedTarget = await createAuthUser();
    const revoked = await invite(tenant.owner.id, tenant.organizationId, revokedTarget.email, "viewer");
    await asUser(tenant.owner.id, (q) =>
      q("update public.invitations set revoked_at = now() where token_hash = $1", [revoked.hash]),
    );
    expect(
      await rejection(asUser(revokedTarget.id, (q) => q("select * from public.accept_invitation($1)", [revoked.hash]))),
    ).toContain("TM_INVITATION_REVOKED");
  });

  it("serializes concurrent acceptance of one token", async () => {
    const tenant = await createTenant();
    const invitee = await createAuthUser({ email: uniqueEmail("race") });
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, invitee.email, "viewer");
    const results = await Promise.allSettled([
      asUser(invitee.id, (q) => q("select * from public.accept_invitation($1)", [hash])),
      asUser(invitee.id, (q) => q("select * from public.accept_invitation($1)", [hash])),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(failed.reason)).toMatch(/TM_INVITATION_USED|duplicate key/);
    const { rows } = await admin("select count(*)::int as n from public.organization_memberships where user_id = $1", [
      invitee.id,
    ]);
    expect(rows[0]!.n).toBe(1);
  });

  it("invitations can only be revoked, not edited", async () => {
    const tenant = await createTenant();
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, uniqueEmail(), "viewer");
    const message = await rejection(
      asUser(tenant.owner.id, (q) => q("update public.invitations set role = 'admin' where token_hash = $1", [hash])),
    );
    expect(message).toContain("permission denied");
  });

  it("an accepted invitation can upgrade but never downgrade an existing membership", async () => {
    const tenant = await createTenant();
    const { hash } = await invite(tenant.owner.id, tenant.organizationId, tenant.manager.email, "viewer");
    await asUser(tenant.manager.id, (q) => q("select * from public.accept_invitation($1)", [hash]));
    const { rows } = await admin("select role from public.organization_memberships where user_id = $1", [
      tenant.manager.id,
    ]);
    expect(rows[0]!.role).toBe("equipment_manager");
  });
});

describe("supplier approvals and audit", () => {
  it("members cannot approve their own organization as a supplier", async () => {
    const tenant = await createTenant("distributor");
    const message = await rejection(
      asUser(tenant.owner.id, (q) =>
        q("insert into public.supplier_approvals (organization_id) values ($1)", [tenant.organizationId]),
      ),
    );
    expect(message).toContain("permission denied");
  });

  it("records membership changes in the audit trail, readable by members only and not writable", async () => {
    const tenant = await createTenant();
    await asUser(tenant.owner.id, (q) =>
      q("update public.organization_memberships set role = 'viewer' where organization_id = $1 and user_id = $2", [
        tenant.organizationId,
        tenant.manager.id,
      ]),
    );
    const events = await asUser(tenant.viewer.id, (q) =>
      q<{ action: string; changed_columns: string[]; actor_user_id: string }>(
        "select action, changed_columns, actor_user_id from public.audit_events where organization_id = $1 and entity_type = 'organization_memberships' and action = 'update'",
        [tenant.organizationId],
      ),
    );
    expect(events.rows[0]).toMatchObject({
      action: "update",
      changed_columns: ["role"],
      actor_user_id: tenant.owner.id,
    });

    const outsider = await createAuthUser();
    const hidden = await asUser(outsider.id, (q) =>
      q("select * from public.audit_events where organization_id = $1", [tenant.organizationId]),
    );
    expect(hidden.rowCount).toBe(0);

    const forged = await rejection(
      asUser(tenant.owner.id, (q) =>
        q("insert into public.audit_events (organization_id, entity_type, action) values ($1, 'x', 'insert')", [
          tenant.organizationId,
        ]),
      ),
    );
    expect(forged).toContain("permission denied");
  });

  it("profiles are visible to co-members and editable only by their owner", async () => {
    const tenant = await createTenant();
    const otherOrg = await createOrganization();
    const stranger = await createAuthUser();
    await addMember(otherOrg, stranger.id, "owner");
    const visible = await asUser(tenant.viewer.id, async (q) =>
      (await q<{ id: string }>("select id from public.profiles")).rows.map((r) => r.id),
    );
    expect(visible).toEqual(expect.arrayContaining([tenant.owner.id, tenant.admin.id]));
    expect(visible).not.toContain(stranger.id);

    await asUser(tenant.viewer.id, (q) =>
      q("update public.profiles set full_name = 'Ponaredek' where id = $1", [tenant.owner.id]),
    );
    const { rows } = await admin("select full_name from public.profiles where id = $1", [tenant.owner.id]);
    expect(rows[0]!.full_name).not.toBe("Ponaredek");
  });
});
