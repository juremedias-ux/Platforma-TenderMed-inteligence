import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryError } from "./equipment";

export interface NotificationRow {
  id: string;
  organization_id: string;
  service_request_id: string | null;
  kind: "due_reminder" | "overdue_reminder" | "service_update" | "assignment";
  title: string;
  body: string | null;
  link_path: string;
  created_at: string;
  read_at: string | null;
}

const COLUMNS = "id, organization_id, service_request_id, kind, title, body, link_path, created_at, read_at";

/** The caller's notifications (RLS limits rows to the recipient). */
export async function listNotifications(
  supabase: SupabaseClient,
  scope: { organizationId?: string; requestsOnly?: boolean; unreadOnly?: boolean },
  limit = 100,
) {
  let query = supabase.from("notifications").select(COLUMNS);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.requestsOnly) query = query.not("service_request_id", "is", null);
  if (scope.unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new QueryError("notifications", error.code);
  return (data ?? []) as NotificationRow[];
}

export async function countUnreadNotifications(supabase: SupabaseClient, organizationId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("read_at", null);
  if (error) throw new QueryError("unread notifications", error.code);
  return count ?? 0;
}

export interface Preferences {
  email_reminders: boolean;
  email_service_updates: boolean;
}

export async function getPreferences(supabase: SupabaseClient, userId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_reminders, email_service_updates")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new QueryError("preferences", error.code);
  return (data as Preferences | null) ?? { email_reminders: true, email_service_updates: true };
}
