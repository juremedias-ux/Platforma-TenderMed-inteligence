import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "@/lib/config/server-env";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { cleanupAbandonedUploads } from "@/lib/documents/cleanup";
import { sendPendingEmails } from "@/lib/notifications/outbox";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Daily scheduled job (vercel.json). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`. Steps:
 *   1. generate due-date reminders for today (Europe/Ljubljana), idempotent;
 *   2. send pending e-mails (when the provider is configured);
 *   3. remove objects of abandoned uploads.
 */
function authorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!getCronSecret()) return Response.json({ error: "cron_not_configured" }, { status: 503, headers });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return Response.json({ error: "backend_not_configured" }, { status: 503, headers });

  const today = ljubljanaDate();
  const reminders = await adminClient.rpc("generate_due_reminders", { p_today: today });
  if (reminders.error) {
    console.error("[cron] reminders failed", reminders.error.code);
    return Response.json({ error: "reminders_failed" }, { status: 500, headers });
  }

  let email: Awaited<ReturnType<typeof sendPendingEmails>> | { status: "error" };
  try {
    email = await sendPendingEmails(100);
  } catch (error) {
    console.error("[cron] e-mail processing failed", error instanceof Error ? error.message : "unknown");
    email = { status: "error" };
  }

  let removedUploads: number | null = null;
  try {
    removedUploads = await cleanupAbandonedUploads(adminClient);
  } catch (error) {
    console.error("[cron] upload cleanup failed", error instanceof Error ? error.message : "unknown");
  }

  return Response.json({ date: today, reminders: reminders.data, email, removedUploads }, { headers });
}
