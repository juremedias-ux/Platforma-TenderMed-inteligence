import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENTS_BUCKET } from "./file-types";

/**
 * Removes objects of uploads that were never finalized (pending for more
 * than a day). Runs with the service role from the scheduled job.
 */
export async function cleanupAbandonedUploads(adminClient: SupabaseClient): Promise<number> {
  const { data, error } = await adminClient.rpc("expire_pending_documents", { p_age: "1 day" });
  if (error) throw new Error(`expire_pending_documents failed: ${error.code ?? "unknown"}`);
  const paths = ((data ?? []) as { storage_path: string }[]).map((row) => row.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    // Missing objects are ignored by Storage; the rows are already marked rejected.
    await adminClient.storage.from(DOCUMENTS_BUCKET).remove(paths.slice(i, i + 100));
  }
  return paths.length;
}
