import "server-only";

import { getSessionUser, getUserClient } from "@/lib/auth/session";

/**
 * Number of active service assignments of the current user. Returns 0 until
 * the service-collaboration tables exist (query error = table missing).
 */
export async function countActiveAssignments(): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await getUserClient();
  const { count, error } = await supabase
    .from("service_assignments")
    .select("id", { count: "exact", head: true })
    .eq("assignee_user_id", user.id)
    .is("revoked_at", null);
  if (error) return 0;
  return count ?? 0;
}
