import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOneOf } from "@/lib/equipment/domain";
import {
  openStatuses,
  requestStatuses,
  type AcknowledgmentStatus,
  type Outcome,
  type Priority,
  type ReplacementStatus,
  type RequestStatus,
  type RequestType,
} from "@/lib/service/domain";
import { QueryError } from "./equipment";

/**
 * Service request queries (caller's client; RLS applies). Members and
 * request-scoped assignees use the same functions — the database decides
 * which rows each of them can read.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ServiceRequestRow {
  id: string;
  organization_id: string;
  reference_number: number;
  equipment_id: string;
  plan_id: string | null;
  request_type: RequestType;
  title: string;
  description: string | null;
  priority: Priority;
  status: RequestStatus;
  replacement_status: ReplacementStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  cancel_reason: string | null;
  closed_at: string | null;
  version: number;
  created_at: string;
  created_by: string | null;
}

const REQUEST_COLUMNS =
  "id, organization_id, reference_number, equipment_id, plan_id, request_type, title, description, priority, status, replacement_status, scheduled_start, scheduled_end, cancel_reason, closed_at, version, created_at, created_by";

export interface RequestFilters {
  view: "open" | "closed" | "all" | RequestStatus;
  q: string;
  equipmentId: string | null;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseRequestFilters(params: Record<string, string | string[] | undefined>): RequestFilters {
  const view = first(params.prikaz);
  const equipmentId = first(params.oprema);
  return {
    view: view === "closed" || view === "all" || isOneOf(requestStatuses, view) ? view : "open",
    q: first(params.q)
      .replace(/[,()*%\\:"'.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    equipmentId: UUID.test(equipmentId) ? equipmentId : null,
  };
}

export interface RequestListItem extends ServiceRequestRow {
  equipment_name: string | null;
}

export async function listRequests(
  supabase: SupabaseClient,
  organizationId: string,
  filters: RequestFilters,
  limit = 200,
) {
  let query = supabase.from("service_requests").select(REQUEST_COLUMNS).eq("organization_id", organizationId);
  if (filters.view === "open") query = query.in("status", openStatuses);
  else if (filters.view === "closed") query = query.in("status", ["zakljuceno", "preklicano"]);
  else if (filters.view !== "all") query = query.eq("status", filters.view);
  if (filters.equipmentId) query = query.eq("equipment_id", filters.equipmentId);
  if (filters.q) {
    const asNumber = /^\d{1,9}$/.test(filters.q) ? `,reference_number.eq.${filters.q}` : "";
    query = query.or(`title.ilike.%${filters.q}%${asNumber}`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new QueryError("service requests", error.code);
  const rows = (data ?? []) as ServiceRequestRow[];
  const names = await equipmentNames(
    supabase,
    organizationId,
    rows.map((r) => r.equipment_id),
  );
  return rows.map((row) => ({ ...row, equipment_name: names.get(row.equipment_id) ?? null }));
}

async function equipmentNames(supabase: SupabaseClient, organizationId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, name")
    .eq("organization_id", organizationId)
    .in("id", unique);
  if (error) throw new QueryError("equipment names", error.code);
  return new Map((data ?? []).map((row) => [row.id as string, row.name as string]));
}

export async function getRequest(supabase: SupabaseClient, requestId: string) {
  if (!UUID.test(requestId)) return null;
  const { data, error } = await supabase
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new QueryError("service request", error.code);
  return (data as ServiceRequestRow | null) ?? null;
}

export interface RequestBrief {
  organization_name: string;
  equipment_name: string;
  equipment_category: string;
  asset_tag: string | null;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location_name: string | null;
  require_completion_acknowledgment: boolean;
}

export async function getRequestBrief(supabase: SupabaseClient, requestId: string): Promise<RequestBrief | null> {
  const { data, error } = await supabase.rpc("service_request_brief", { p_request: requestId });
  if (error) throw new QueryError("request brief", error.code);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as RequestBrief | undefined) ?? null;
}

export interface ProposalRow {
  id: string;
  proposed_by: string | null;
  proposed_as: "member" | "assignee";
  starts_at: string;
  ends_at: string;
  note: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  author_id: string | null;
  visibility: "shared" | "internal";
  body: string;
  created_at: string;
}

export interface CompletionRow {
  id: string;
  service_request_id: string;
  equipment_id: string;
  plan_id: string | null;
  completed_on: string;
  outcome: Outcome;
  summary: string;
  recorded_by: string | null;
  recorded_as: "member" | "assignee";
  acknowledgment_status: AcknowledgmentStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgment_note: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  replaces_id: string | null;
  created_at: string;
}

const COMPLETION_COLUMNS =
  "id, service_request_id, equipment_id, plan_id, completed_on, outcome, summary, recorded_by, recorded_as, acknowledgment_status, acknowledged_by, acknowledged_at, acknowledgment_note, voided_at, voided_by, void_reason, replaces_id, created_at";

export interface EventRow {
  id: number;
  actor_user_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  assignee_user_id: string;
  assigned_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export async function getRequestThread(supabase: SupabaseClient, requestId: string) {
  const [proposals, messages, completions, events, assignments] = await Promise.all([
    supabase
      .from("appointment_proposals")
      .select(
        "id, proposed_by, proposed_as, starts_at, ends_at, note, status, decided_by, decided_at, decision_note, created_at",
      )
      .eq("service_request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_messages")
      .select("id, author_id, visibility, body, created_at")
      .eq("service_request_id", requestId)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("completion_records")
      .select(COMPLETION_COLUMNS)
      .eq("service_request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_events")
      .select("id, actor_user_id, event_type, from_status, to_status, created_at")
      .eq("service_request_id", requestId)
      .order("id", { ascending: false })
      .limit(100),
    supabase
      .from("service_assignments")
      .select("id, assignee_user_id, assigned_by, created_at, revoked_at")
      .eq("service_request_id", requestId)
      .order("created_at"),
  ]);
  for (const result of [proposals, messages, completions, events, assignments]) {
    if (result.error) throw new QueryError("request thread", result.error.code);
  }
  return {
    proposals: (proposals.data ?? []) as ProposalRow[],
    messages: (messages.data ?? []) as MessageRow[],
    completions: (completions.data ?? []) as CompletionRow[],
    events: (events.data ?? []) as EventRow[],
    assignments: (assignments.data ?? []) as AssignmentRow[],
  };
}

/** Display names for profile ids the caller may see (others resolve to null). */
export async function profileNames(supabase: SupabaseClient, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  if (error) throw new QueryError("profiles", error.code);
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null) || (p.email as string | null) || "Uporabnik",
    ]),
  );
}

export async function listCompletionsForEquipment(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
) {
  const { data, error } = await supabase
    .from("completion_records")
    .select(COMPLETION_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("completed_on", { ascending: false })
    .limit(100);
  if (error) throw new QueryError("equipment completions", error.code);
  return (data ?? []) as CompletionRow[];
}

export async function listRequestsForEquipment(supabase: SupabaseClient, organizationId: string, equipmentId: string) {
  const { data, error } = await supabase
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new QueryError("equipment requests", error.code);
  return (data ?? []) as ServiceRequestRow[];
}

export interface AssignmentListItem {
  service_request_id: string;
  organization_id: string;
  organization_name: string;
  reference_number: number;
  title: string;
  request_type: RequestType;
  priority: Priority;
  status: RequestStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  equipment_name: string;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location_name: string | null;
  assigned_at: string;
}

export async function listMyAssignments(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("my_service_assignments");
  if (error) throw new QueryError("my assignments", error.code);
  return (data ?? []) as AssignmentListItem[];
}

export async function countOpenRequests(supabase: SupabaseClient, organizationId: string) {
  const { count, error } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", openStatuses);
  if (error) throw new QueryError("open requests", error.code);
  return count ?? 0;
}

export async function countAwaitingAcknowledgment(supabase: SupabaseClient, organizationId: string) {
  const { count, error } = await supabase
    .from("completion_records")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("acknowledgment_status", "pending")
    .is("voided_at", null);
  if (error) throw new QueryError("pending acknowledgments", error.code);
  return count ?? 0;
}

export interface EquipmentChoiceRow {
  id: string;
  name: string;
  plans: { id: string; label: string }[];
}

/** Non-archived equipment with active plans, for the new-request form. */
export async function listEquipmentChoices(
  supabase: SupabaseClient,
  organizationId: string,
  planLabel: (plan: { activity_type: string; activity_label: string | null; next_due_date: string | null }) => string,
): Promise<EquipmentChoiceRow[]> {
  const [equipment, plans] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, name, asset_tag")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("name")
      .limit(1000),
    supabase
      .from("maintenance_plans")
      .select("id, equipment_id, activity_type, activity_label, next_due_date")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(5000),
  ]);
  if (equipment.error) throw new QueryError("equipment choices", equipment.error.code);
  if (plans.error) throw new QueryError("plan choices", plans.error.code);
  return (equipment.data ?? []).map((e) => ({
    id: e.id as string,
    name: e.asset_tag ? `${e.name} (${e.asset_tag})` : (e.name as string),
    plans: (plans.data ?? [])
      .filter((p) => p.equipment_id === e.id)
      .map((p) => ({ id: p.id as string, label: planLabel(p) })),
  }));
}
