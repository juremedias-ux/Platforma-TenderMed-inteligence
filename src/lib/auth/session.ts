import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { isUuid, safeNextPath } from "./paths";
import { can, isOrgRole, type OrgRole, type Permission } from "./permissions";

export { isUuid, safeNextPath };

/**
 * Data access layer for identity and organization access.
 *
 * - Identity comes from `auth.getClaims()`, which verifies the JWT signature
 *   (never from unverified session contents).
 * - Organization access is re-read from the database for every request; the
 *   organization id in a URL is only a resource identifier.
 * - Every page, Server Action and Route Handler calls these helpers itself;
 *   RLS enforces the same rules in the database.
 */

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  kind: string;
}

export interface Membership {
  organization: OrganizationSummary;
  role: OrgRole;
}

export interface OrgContext {
  user: SessionUser;
  supabase: SupabaseClient;
  organization: OrganizationSummary & { requireCompletionAcknowledgment: boolean };
  role: OrgRole;
}

export class AuthorizationError extends Error {
  constructor(message = "TM_FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// connection() makes every page that touches the session render at request
// time, even when configuration is missing at build time.
const getClient = cache(async () => {
  await connection();
  return createSupabaseServerClient();
});

export const isPlatformConfigured = cache(async () => (await getClient()) !== null);

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email.toLowerCase() : null;
  return { id: data.claims.sub, email };
});

/** Supabase client bound to the current session (RLS applies). */
export async function getUserClient(): Promise<SupabaseClient> {
  const supabase = await getClient();
  if (!supabase) throw new AuthorizationError("TM_NOT_CONFIGURED");
  return supabase;
}

/** Redirects to the login page when there is no verified session. */
export async function requireUser(nextPath = "/app"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return user;
}

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getSessionUser();
  const supabase = await getClient();
  if (!user || !supabase) return [];
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(id, name, kind)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`memberships query failed: ${error.code ?? "unknown"}`);
  return (data ?? []).flatMap((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!organization || !isOrgRole(row.role)) return [];
    return [{ role: row.role, organization: organization as OrganizationSummary }];
  });
});

/**
 * Loads the caller's membership in an organization. Returns null when the
 * caller is not a member (or the organization does not exist) — both look
 * the same, so URLs do not reveal which organizations exist.
 */
export const getOrgContext = cache(async (organizationId: string): Promise<OrgContext | null> => {
  if (!isUuid(organizationId)) return null;
  const user = await getSessionUser();
  const supabase = await getClient();
  if (!user || !supabase) return null;
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(id, name, kind, require_completion_acknowledgment)")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`organization access query failed: ${error.code ?? "unknown"}`);
  if (!data || !isOrgRole(data.role)) return null;
  const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as {
    id: string;
    name: string;
    kind: string;
    require_completion_acknowledgment: boolean;
  };
  return {
    user,
    supabase,
    role: data.role,
    organization: {
      id: org.id,
      name: org.name,
      kind: org.kind,
      requireCompletionAcknowledgment: org.require_completion_acknowledgment,
    },
  };
});

/** For Server Actions and Route Handlers: throws unless the caller has the permission. */
export async function requireOrgPermission(organizationId: string, permission: Permission): Promise<OrgContext> {
  const context = await getOrgContext(organizationId);
  if (!context) throw new AuthorizationError();
  if (!can(context.role, permission)) throw new AuthorizationError();
  return context;
}

/**
 * Page guard: redirects to login without a verified session; returns null
 * when the user has no membership (the page renders a "no access" state).
 * Pages call this themselves because layouts and pages render independently.
 */
export async function requireOrgPage(organizationId: string, path: string): Promise<OrgContext | null> {
  await requireUser(path);
  return getOrgContext(organizationId);
}
