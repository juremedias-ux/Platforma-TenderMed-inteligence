import "server-only";

import { getSessionUser, getUserClient } from "@/lib/auth/session";

/** Number of active service assignments of the current user (throws on query errors). */
export async function countActiveAssignments(): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await getUserClient();
  const { count, error } = await supabase
    .from("service_assignments")
    .select("id", { count: "exact", head: true })
    .eq("assignee_user_id", user.id)
    .is("revoked_at", null);
  if (error) throw new Error(`assignments query failed: ${error.code ?? "unknown"}`);
  return count ?? 0;
}
