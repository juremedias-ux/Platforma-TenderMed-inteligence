import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailConfig, getPublicAppUrl } from "@/lib/config/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { createResendAdapter, renderNotificationEmail, type EmailAdapter } from "./email";

export interface OutboxRunResult {
  status: "processed" | "email_not_configured" | "backend_not_configured";
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

interface ClaimedRow {
  id: number;
  idempotency_key: string;
  to_email: string;
  title: string;
  body: string | null;
  link_path: string;
  attempts: number;
}

/** Claims due outbox rows and sends them; claim_outbox re-checks access and preferences. */
export async function processOutbox(
  adminClient: SupabaseClient,
  adapter: EmailAdapter,
  appUrl: string,
  limit = 20,
): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { status: "processed", claimed: 0, sent: 0, retried: 0, failed: 0 };
  const { data, error } = await adminClient.rpc("claim_outbox", { p_limit: limit });
  if (error) throw new Error(`claim_outbox failed: ${error.code ?? "unknown"}`);
  const rows = (data ?? []) as ClaimedRow[];
  result.claimed = rows.length;
  for (const row of rows) {
    const email = renderNotificationEmail(row, appUrl);
    const outcome = await adapter.send({ to: row.to_email, ...email, idempotencyKey: row.idempotency_key });
    const completion = await adminClient.rpc("complete_outbox", {
      p_id: row.id,
      p_result: outcome.kind,
      p_provider_id: outcome.kind === "sent" ? outcome.providerId : null,
      p_error: outcome.kind === "sent" ? null : outcome.error,
    });
    if (completion.error) throw new Error(`complete_outbox failed: ${completion.error.code ?? "unknown"}`);
    if (outcome.kind === "sent") result.sent += 1;
    else if (outcome.kind === "retry") result.retried += 1;
    else result.failed += 1;
  }
  return result;
}

/** Sends pending e-mails when everything is configured; otherwise reports why nothing was sent. */
export async function sendPendingEmails(limit = 20): Promise<OutboxRunResult> {
  const empty = { claimed: 0, sent: 0, retried: 0, failed: 0 };
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return { status: "backend_not_configured", ...empty };
  const emailConfig = getEmailConfig();
  const appUrl = getPublicAppUrl();
  if (!emailConfig || !appUrl) return { status: "email_not_configured", ...empty };
  return processOutbox(adminClient, createResendAdapter(emailConfig), appUrl, limit);
}

/** For after(): never throws (the user's action has already succeeded). */
export async function sendPendingEmailsQuietly(): Promise<void> {
  try {
    await sendPendingEmails(10);
  } catch (error) {
    console.error("[notifications] immediate send failed", error instanceof Error ? error.message : "unknown");
  }
}
