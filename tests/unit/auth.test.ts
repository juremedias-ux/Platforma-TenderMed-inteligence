import { describe, expect, it } from "vitest";
import { isUuid, safeNextPath } from "@/lib/auth/paths";
import { assignableRoles, can, invitableRoles, orgRoles, permissionMatrix } from "@/lib/auth/permissions";
import { byteaHex, createInvitationToken, hashInvitationToken, isWellFormedToken } from "@/lib/auth/tokens";
import { ljubljanaWallTimeToUtc, toLjubljanaParts } from "@/lib/dates/datetime";

describe("permission matrix", () => {
  it("gives viewers read-only access", () => {
    const viewerPermissions = (Object.keys(permissionMatrix) as (keyof typeof permissionMatrix)[]).filter((p) =>
      can("viewer", p),
    );
    expect(viewerPermissions.every((p) => p.endsWith(".view"))).toBe(true);
  });

  it("reserves organization settings for owners and member management for owners and admins", () => {
    expect(orgRoles.filter((r) => can(r, "org.settings"))).toEqual(["owner"]);
    expect(orgRoles.filter((r) => can(r, "members.manage"))).toEqual(["owner", "admin"]);
    expect(orgRoles.filter((r) => can(r, "service.assign"))).toEqual(["owner", "admin"]);
  });

  it("never lets anyone grant a role above their own", () => {
    expect(invitableRoles("owner")).toEqual(["owner", "admin", "equipment_manager", "viewer"]);
    expect(invitableRoles("admin")).toEqual(["admin", "equipment_manager", "viewer"]);
    expect(invitableRoles("equipment_manager")).toEqual([]);
    expect(invitableRoles("viewer")).toEqual([]);
  });

  it("keeps owners out of reach of admins", () => {
    expect(assignableRoles("admin", "owner")).toEqual([]);
    expect(assignableRoles("admin", "viewer")).not.toContain("owner");
    expect(assignableRoles("owner", "admin")).toContain("owner");
    expect(assignableRoles("equipment_manager", "viewer")).toEqual([]);
  });

  it("denies everything without a role", () => {
    expect(can(null, "org.view")).toBe(false);
    expect(can(undefined, "equipment.view")).toBe(false);
  });
});

describe("post-login redirect targets", () => {
  it.each([
    ["/app/abc/oprema", "/app/abc/oprema"],
    ["/povabilo/xyz", "/povabilo/xyz"],
    ["/ponastavitev-gesla", "/ponastavitev-gesla"],
    ["https://evil.example/app", "/app"],
    ["//evil.example", "/app"],
    ["/\\evil.example", "/app"],
    ["/zasebnost", "/app"],
    ["", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("validates UUIDs", () => {
    expect(isUuid("0b7c3f4e-2a1d-4b9e-8f00-123456789abc")).toBe(true);
    expect(isUuid("../etc")).toBe(false);
  });
});

describe("invitation tokens", () => {
  it("creates 256-bit tokens whose SHA-256 hash is stored instead of the token", () => {
    const { token, hashHex } = createInvitationToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(hashHex).toHaveLength(64);
    expect(hashInvitationToken(token)).toBe(hashHex);
    expect(hashHex).not.toContain(token);
    expect(byteaHex(hashHex)).toBe(`\\x${hashHex}`);
    expect(isWellFormedToken("short")).toBe(false);
    expect(createInvitationToken().token).not.toBe(token);
  });
});

describe("Europe/Ljubljana appointments", () => {
  it("converts winter and summer wall-clock times", () => {
    expect(ljubljanaWallTimeToUtc("2027-01-15", "09:00")?.toISOString()).toBe("2027-01-15T08:00:00.000Z");
    expect(ljubljanaWallTimeToUtc("2027-07-15", "09:00")?.toISOString()).toBe("2027-07-15T07:00:00.000Z");
  });

  it("rejects non-existent times in the spring DST gap", () => {
    // Clocks jump from 02:00 to 03:00 on 29 March 2026.
    expect(ljubljanaWallTimeToUtc("2026-03-29", "02:30")).toBeNull();
    expect(ljubljanaWallTimeToUtc("2026-03-29", "03:30")?.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("resolves ambiguous autumn times to the first (summer-time) occurrence", () => {
    // 02:30 occurs twice on 25 October 2026.
    expect(ljubljanaWallTimeToUtc("2026-10-25", "02:30")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("round-trips through local parts", () => {
    const instant = ljubljanaWallTimeToUtc("2028-02-29", "23:45")!;
    expect(toLjubljanaParts(instant)).toEqual({ date: "2028-02-29", time: "23:45" });
    expect(ljubljanaWallTimeToUtc("2027-02-29", "10:00")).toBeNull();
  });
});
