import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, type IsoDate } from "@/lib/dates/date-only";
import {
  equipmentCategories,
  equipmentStatuses,
  isOneOf,
  type ActivityType,
  type EquipmentCategory,
  type EquipmentStatus,
  type ScheduleMode,
  type SourceBasis,
} from "@/lib/equipment/domain";
import { serialKey, type ExistingIdentifiers } from "@/lib/equipment/csv-format";
import { DUE_SOON_DAYS } from "@/lib/maintenance/schedule";

/**
 * Equipment queries. Every function takes the caller's Supabase client, so
 * RLS applies; organization_id filters are added as well (defence in depth
 * and index use). Failures throw: callers render an error state and never
 * fall back to demo data.
 */

export class QueryError extends Error {
  constructor(what: string, code?: string) {
    super(`${what} query failed: ${code ?? "unknown"}`);
    this.name = "QueryError";
  }
}

export interface EquipmentRow {
  id: string;
  organization_id: string;
  asset_tag: string | null;
  name: string;
  category: EquipmentCategory;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location_id: string | null;
  location_name: string | null;
  responsible_user_id: string | null;
  purchase_date: IsoDate | null;
  commissioning_date: IsoDate | null;
  warranty_end_date: IsoDate | null;
  status: EquipmentStatus;
  notes: string | null;
  version: number;
  next_due_date: IsoDate | null;
  created_at: string;
  updated_at: string;
}

const EQUIPMENT_COLUMNS =
  "id, organization_id, asset_tag, name, category, manufacturer_name, model, serial_number, location_id, location_name, responsible_user_id, purchase_date, commissioning_date, warranty_end_date, status, notes, version, next_due_date, created_at, updated_at";

export interface EquipmentFilters {
  q: string;
  status: EquipmentStatus | "current";
  category: EquipmentCategory | null;
  locationId: string | null;
  page: number;
}

export const EQUIPMENT_PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseEquipmentFilters(params: Record<string, string | string[] | undefined>): EquipmentFilters {
  const status = first(params.status);
  const category = first(params.kategorija);
  const locationId = first(params.lokacija);
  const page = Number.parseInt(first(params.stran), 10);
  return {
    // PostgREST filter syntax characters are removed from free text.
    q: first(params.q)
      .replace(/[,()*%\\:"'.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    status: isOneOf(equipmentStatuses, status) ? status : "current",
    category: isOneOf(equipmentCategories, category) ? category : null,
    locationId: UUID.test(locationId) ? locationId : null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

export async function listEquipment(supabase: SupabaseClient, organizationId: string, filters: EquipmentFilters) {
  let query = supabase
    .from("equipment_overview")
    .select(EQUIPMENT_COLUMNS, { count: "exact" })
    .eq("organization_id", organizationId);
  query = filters.status === "current" ? query.neq("status", "archived") : query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      ["name", "asset_tag", "serial_number", "model", "manufacturer_name"].map((c) => `${c}.ilike.${term}`).join(","),
    );
  }
  const from = (filters.page - 1) * EQUIPMENT_PAGE_SIZE;
  const { data, error, count } = await query
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + EQUIPMENT_PAGE_SIZE - 1);
  if (error) throw new QueryError("equipment list", error.code);
  return { rows: (data ?? []) as EquipmentRow[], total: count ?? 0 };
}

export async function getEquipment(supabase: SupabaseClient, organizationId: string, equipmentId: string) {
  if (!UUID.test(equipmentId)) return null;
  const { data, error } = await supabase
    .from("equipment_overview")
    .select(EQUIPMENT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", equipmentId)
    .maybeSingle();
  if (error) throw new QueryError("equipment detail", error.code);
  return (data as EquipmentRow | null) ?? null;
}

export interface PlanRow {
  id: string;
  equipment_id: string;
  activity_type: ActivityType;
  activity_label: string | null;
  schedule_mode: ScheduleMode;
  interval_months: number | null;
  anchor_date: IsoDate | null;
  due_date: IsoDate | null;
  last_completed_on: IsoDate | null;
  next_due_date: IsoDate | null;
  responsible_user_id: string | null;
  reminder_days: number[];
  source_basis: SourceBasis;
  source_note: string | null;
  status: "active" | "archived";
  version: number;
}

export async function listPlans(supabase: SupabaseClient, organizationId: string, equipmentId: string) {
  const { data, error } = await supabase
    .from("maintenance_plans")
    .select(
      "id, equipment_id, activity_type, activity_label, schedule_mode, interval_months, anchor_date, due_date, last_completed_on, next_due_date, responsible_user_id, reminder_days, source_basis, source_note, status, version",
    )
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("status", { ascending: true })
    .order("next_due_date", { ascending: true, nullsFirst: false });
  if (error) throw new QueryError("plans", error.code);
  return (data ?? []) as PlanRow[];
}

export interface LocationRow {
  id: string;
  name: string;
  archived_at: string | null;
  version: number;
}

export async function listLocations(supabase: SupabaseClient, organizationId: string, includeArchived = false) {
  let query = supabase.from("locations").select("id, name, archived_at, version").eq("organization_id", organizationId);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("name");
  if (error) throw new QueryError("locations", error.code);
  return (data ?? []) as LocationRow[];
}

export interface MemberOption {
  id: string;
  name: string;
}

export async function listMemberOptions(supabase: SupabaseClient, organizationId: string): Promise<MemberOption[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles!organization_memberships_user_id_fkey(full_name, email)")
    .eq("organization_id", organizationId);
  if (error) throw new QueryError("members", error.code);
  return (data ?? [])
    .map((row) => {
      const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as
        { full_name: string | null; email: string | null } | null | undefined;
      return { id: row.user_id as string, name: profile?.full_name || profile?.email || "Član" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "sl"));
}

export async function getExistingIdentifiers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ExistingIdentifiers> {
  const assetTags = new Set<string>();
  const serials = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("equipment")
      .select("asset_tag, manufacturer_name, serial_number")
      .eq("organization_id", organizationId)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new QueryError("identifiers", error.code);
    for (const row of data ?? []) {
      if (row.asset_tag) assetTags.add(String(row.asset_tag).toLowerCase());
      if (row.serial_number) serials.add(serialKey(row.manufacturer_name, String(row.serial_number)));
    }
    if (!data || data.length < pageSize) break;
  }
  return { assetTags, serials };
}

export interface AgendaRow {
  id: string;
  equipment_id: string;
  activity_type: ActivityType;
  activity_label: string | null;
  schedule_mode: ScheduleMode;
  next_due_date: IsoDate;
  last_completed_on: IsoDate | null;
  responsible_user_id: string | null;
  equipment_name: string;
  asset_tag: string | null;
  equipment_status: EquipmentStatus;
  location_name: string | null;
}

const AGENDA_COLUMNS =
  "id, equipment_id, activity_type, activity_label, schedule_mode, next_due_date, last_completed_on, responsible_user_id, equipment_name, asset_tag, equipment_status, location_name";

/** Open due dates up to `until` (overdue ones included), earliest first. */
export async function listAgenda(supabase: SupabaseClient, organizationId: string, until: IsoDate, limit = 500) {
  const { data, error } = await supabase
    .from("maintenance_agenda")
    .select(AGENDA_COLUMNS)
    .eq("organization_id", organizationId)
    .lte("next_due_date", until)
    .order("next_due_date", { ascending: true })
    .order("equipment_name", { ascending: true })
    .limit(limit);
  if (error) throw new QueryError("agenda", error.code);
  return (data ?? []) as AgendaRow[];
}

export interface OverviewCounts {
  equipment: number;
  unavailable: number;
  withoutOpenDue: number;
  overdue: number;
  dueSoon: number;
}

export async function getOverviewCounts(
  supabase: SupabaseClient,
  organizationId: string,
  today: IsoDate,
): Promise<OverviewCounts> {
  const count = async (promise: PromiseLike<{ count: number | null; error: { code?: string } | null }>) => {
    const { count: value, error } = await promise;
    if (error) throw new QueryError("overview", error.code);
    return value ?? 0;
  };
  const equipment = () =>
    supabase
      .from("equipment_overview")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "archived");
  const agenda = () =>
    supabase
      .from("maintenance_agenda")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);

  const [all, unavailable, withoutOpenDue, overdue, dueSoon] = await Promise.all([
    count(equipment()),
    count(equipment().in("status", ["in_service", "temporarily_out"])),
    count(equipment().is("next_due_date", null)),
    count(agenda().lt("next_due_date", today)),
    count(agenda().gte("next_due_date", today).lte("next_due_date", addDays(today, DUE_SOON_DAYS))),
  ]);
  return { equipment: all, unavailable, withoutOpenDue, overdue, dueSoon };
}

export interface AuditRow {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_columns: string[];
  actor_user_id: string | null;
  created_at: string;
}

export async function listAuditFor(supabase: SupabaseClient, organizationId: string, entityIds: string[], limit = 30) {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, entity_type, entity_id, action, changed_columns, actor_user_id, created_at")
    .eq("organization_id", organizationId)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new QueryError("audit", error.code);
  return (data ?? []) as AuditRow[];
}
