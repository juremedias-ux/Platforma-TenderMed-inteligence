"use server";

import { refresh } from "next/cache";
import { getSessionUser, getUserClient, isUuid } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/db/errors";
import type { ActionState } from "@/lib/forms/action-state";

/** Marks the caller's notifications as read: one id, or all unread ones in an organization (or all). */
export async function markNotificationsReadAction(target: {
  id?: string;
  organizationId?: string;
}): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Prijavite se znova." };
  if ((target.id && !isUuid(target.id)) || (target.organizationId && !isUuid(target.organizationId))) {
    return { status: "error", message: "Neveljaven zahtevek." };
  }
  const supabase = await getUserClient();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", user.id)
    .is("read_at", null);
  if (target.id) query = query.eq("id", target.id);
  if (target.organizationId) query = query.eq("organization_id", target.organizationId);
  const { error } = await query;
  if (error) return { status: "error", message: dbErrorMessage(error) };
  refresh();
  return { status: "success", message: "Obvestila so označena kot prebrana." };
}

export async function updatePreferencesAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Prijavite se znova." };
  const supabase = await getUserClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      email_reminders: formData.get("emailReminders") === "on",
      email_service_updates: formData.get("emailServiceUpdates") === "on",
    },
    { onConflict: "user_id" },
  );
  if (error) return { status: "error", message: dbErrorMessage(error) };
  refresh();
  return { status: "success", message: "Nastavitve obvestil so shranjene." };
}
