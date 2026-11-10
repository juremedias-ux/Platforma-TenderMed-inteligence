/**
 * Organization permission matrix (mirrors the RLS policies; see
 * docs/permission-matrix.md). UI uses it to decide what to show; every
 * Server Action checks it again on the server, and RLS enforces it in the
 * database. Hidden buttons are never the only protection.
 */

export const orgRoles = ["owner", "admin", "equipment_manager", "viewer"] as const;
export type OrgRole = (typeof orgRoles)[number];

export const orgRoleLabels: Record<OrgRole, string> = {
  owner: "Lastnik",
  admin: "Skrbnik",
  equipment_manager: "Upravljavec opreme",
  viewer: "Pregledovalec",
};

export const orgRoleDescriptions: Record<OrgRole, string> = {
  owner: "Nastavitve organizacije, upravljanje članov in lastnikov ter vse operativne naloge.",
  admin: "Operativno upravljanje, vabljenje in upravljanje članov (razen lastnikov).",
  equipment_manager: "Oprema, servisni načrti, dokumenti in usklajevanje servisov.",
  viewer: "Samo pregled podatkov organizacije.",
};

const ALL: OrgRole[] = ["owner", "admin", "equipment_manager", "viewer"];
const OPERATORS: OrgRole[] = ["owner", "admin", "equipment_manager"];
const ADMINS: OrgRole[] = ["owner", "admin"];

export const permissionMatrix = {
  "org.view": ALL,
  "org.settings": ["owner"],
  "members.view": ALL,
  "members.manage": ADMINS,
  "invitations.manage": ADMINS,
  "equipment.view": ALL,
  "equipment.manage": OPERATORS,
  "equipment.import": OPERATORS,
  "equipment.export": OPERATORS,
  "plans.manage": OPERATORS,
  "service.view": ALL,
  "service.create": OPERATORS,
  "service.coordinate": OPERATORS,
  "service.assign": ADMINS,
  "completion.record": OPERATORS,
  "completion.acknowledge": OPERATORS,
  "completion.void": ADMINS,
  "documents.view": ALL,
  "documents.manage": OPERATORS,
  "documents.share": OPERATORS,
  "audit.view": ALL,
  "catalog.view": ALL,
  "catalog.manage": ADMINS,
  "recommendations.view": ALL,
  "recommendations.feedback": OPERATORS,
  "supplier.inquire": OPERATORS,
} as const satisfies Record<string, readonly OrgRole[]>;

export type Permission = keyof typeof permissionMatrix;

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (orgRoles as readonly string[]).includes(value);
}

export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (permissionMatrix[permission] as readonly OrgRole[]).includes(role);
}

const rank: Record<OrgRole, number> = { owner: 4, admin: 3, equipment_manager: 2, viewer: 1 };

/** Roles an actor may grant through invitations (never above their own role). */
export function invitableRoles(actor: OrgRole): OrgRole[] {
  if (!can(actor, "invitations.manage")) return [];
  return orgRoles.filter((role) => rank[role] <= rank[actor]);
}

/** Roles an actor may assign to another member (admins never touch owners). */
export function assignableRoles(actor: OrgRole, target: OrgRole): OrgRole[] {
  if (!can(actor, "members.manage")) return [];
  if (actor === "owner") return [...orgRoles];
  if (target === "owner") return [];
  return orgRoles.filter((role) => role !== "owner");
}
