"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { AuthorizationError, isUuid, requireOrgPermission } from "@/lib/auth/session";
import { decodeCsvBytes } from "@/lib/csv/csv";
import { MAX_IMPORT_BYTES, validateEquipmentCsv } from "@/lib/equipment/csv-format";
import { dbErrorMessage, registerErrorMessages } from "@/lib/db/errors";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { getExistingIdentifiers } from "@/lib/repositories/equipment";
import {
  equipmentFormKeys,
  equipmentSchema,
  locationNameSchema,
  planFormKeys,
  planSchema,
  versionSchema,
  type EquipmentInput,
} from "@/lib/validation/equipment-schemas";

registerErrorMessages({
  TM_RESPONSIBLE_NOT_MEMBER: "Odgovorna oseba mora biti član organizacije.",
  TM_ORGANIZATION_IMMUTABLE: "Zapisa ni mogoče prenesti v drugo organizacijo.",
  TM_IMPORT_EMPTY: "Datoteka nima vrstic z opremo.",
  TM_IMPORT_TOO_LARGE: "Uvozite lahko največ 500 vrstic naenkrat.",
  TM_FORBIDDEN: "Za to dejanje nimate dovoljenja.",
});

const FORBIDDEN: ActionState = { status: "error", message: "Za to dejanje nimate dovoljenja." };
const CONFLICT: ActionState = {
  status: "error",
  message: "Podatke je medtem spremenil nekdo drug. Osvežite stran in poskusite znova.",
};

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof AuthorizationError) return { ...FORBIDDEN, values };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23505") {
    const text = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (text.includes("asset_tag")) {
      return { status: "error", values, fieldErrors: { assetTag: "Oprema s to inventarno številko že obstaja." } };
    }
    if (text.includes("serial")) {
      return {
        status: "error",
        values,
        fieldErrors: { serialNumber: "Oprema s to serijsko številko tega proizvajalca že obstaja." },
      };
    }
  }
  return { status: "error", message: dbErrorMessage(error), values };
}

/** After a versioned update matched no row: distinguishes a concurrent edit from missing access. */
async function conflictOrForbidden(supabase: SupabaseClient, table: string, organizationId: string, id: string) {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  return data ? CONFLICT : FORBIDDEN;
}

async function resolveLocation(
  supabase: SupabaseClient,
  organizationId: string,
  input: Pick<EquipmentInput, "locationId" | "newLocation">,
): Promise<string | null> {
  if (input.locationId) return input.locationId;
  if (!input.newLocation) return null;
  const findExisting = async () => {
    const { data, error } = await supabase.from("locations").select("id, name").eq("organization_id", organizationId);
    if (error) throw error;
    return data?.find((l) => l.name.toLowerCase() === input.newLocation!.toLowerCase())?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("locations")
    .insert({ organization_id: organizationId, name: input.newLocation })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return findExisting();
    throw error;
  }
  return data.id;
}

function parseEquipment(formData: FormData) {
  const values = formValues(formData, [...equipmentFormKeys]);
  return { values, parsed: equipmentSchema.safeParse(values) };
}

function equipmentColumns(input: EquipmentInput, locationId: string | null) {
  return {
    name: input.name,
    category: input.category,
    asset_tag: input.assetTag,
    manufacturer_name: input.manufacturerName,
    model: input.model,
    serial_number: input.serialNumber,
    location_id: locationId,
    responsible_user_id: input.responsibleUserId,
    purchase_date: input.purchaseDate,
    commissioning_date: input.commissioningDate,
    warranty_end_date: input.warrantyEndDate,
    status: input.status,
    notes: input.notes,
  };
}

export async function createEquipmentAction(
  organizationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { values, parsed } = parseEquipment(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  let id: string;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.manage");
    const locationId = await resolveLocation(supabase, organizationId, parsed.data);
    const { data, error } = await supabase
      .from("equipment")
      .insert({ organization_id: organizationId, ...equipmentColumns(parsed.data, locationId) })
      .select("id")
      .single();
    if (error) return failure(error, values);
    id = data.id;
  } catch (error) {
    return failure(error, values);
  }
  redirect(`/app/${organizationId}/oprema/${id}`);
}

export async function updateEquipmentAction(
  organizationId: string,
  equipmentId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { values, parsed } = parseEquipment(formData);
  const version = versionSchema.safeParse(formData.get("version"));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!version.success || !isUuid(equipmentId)) return { status: "error", message: "Neveljaven zahtevek.", values };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.manage");
    const locationId = await resolveLocation(supabase, organizationId, parsed.data);
    const { data, error } = await supabase
      .from("equipment")
      .update(equipmentColumns(parsed.data, locationId))
      .eq("organization_id", organizationId)
      .eq("id", equipmentId)
      .eq("version", version.data)
      .select("id");
    if (error) return failure(error, values);
    if (!data?.length)
      return { ...(await conflictOrForbidden(supabase, "equipment", organizationId, equipmentId)), values };
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Podatki o opremi so shranjeni." };
}

export async function setEquipmentArchivedAction(
  organizationId: string,
  equipmentId: string,
  version: number,
  archived: boolean,
): Promise<ActionState> {
  if (!isUuid(equipmentId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.manage");
    const { data, error } = await supabase
      .from("equipment")
      .update({ status: archived ? "archived" : "active" })
      .eq("organization_id", organizationId)
      .eq("id", equipmentId)
      .eq("version", version)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return conflictOrForbidden(supabase, "equipment", organizationId, equipmentId);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: archived ? "Oprema je arhivirana." : "Oprema je ponovno v evidenci." };
}

function planColumns(input: ReturnType<typeof planSchema.parse>) {
  return {
    activity_type: input.activityType,
    activity_label: input.activityLabel,
    schedule_mode: input.scheduleMode,
    interval_months: input.intervalMonths,
    anchor_date: input.anchorDate,
    due_date: input.dueDate,
    responsible_user_id: input.responsibleUserId,
    reminder_days: input.reminderDays,
    source_basis: input.sourceBasis,
    source_note: input.sourceNote,
  };
}

export async function createPlanAction(
  organizationId: string,
  equipmentId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, [...planFormKeys]);
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!isUuid(equipmentId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "plans.manage");
    const { error } = await supabase
      .from("maintenance_plans")
      .insert({ organization_id: organizationId, equipment_id: equipmentId, ...planColumns(parsed.data) });
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Servisni načrt je dodan." };
}

export async function updatePlanAction(
  organizationId: string,
  planId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, [...planFormKeys]);
  const parsed = planSchema.safeParse(values);
  const version = versionSchema.safeParse(formData.get("version"));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!version.success || !isUuid(planId)) return { status: "error", message: "Neveljaven zahtevek.", values };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "plans.manage");
    const { data, error } = await supabase
      .from("maintenance_plans")
      .update(planColumns(parsed.data))
      .eq("organization_id", organizationId)
      .eq("id", planId)
      .eq("version", version.data)
      .select("id");
    if (error) return failure(error, values);
    if (!data?.length)
      return { ...(await conflictOrForbidden(supabase, "maintenance_plans", organizationId, planId)), values };
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Servisni načrt je shranjen." };
}

export async function setPlanArchivedAction(
  organizationId: string,
  planId: string,
  version: number,
  archived: boolean,
): Promise<ActionState> {
  if (!isUuid(planId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "plans.manage");
    const { data, error } = await supabase
      .from("maintenance_plans")
      .update({ status: archived ? "archived" : "active" })
      .eq("organization_id", organizationId)
      .eq("id", planId)
      .eq("version", version)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return conflictOrForbidden(supabase, "maintenance_plans", organizationId, planId);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: archived ? "Načrt je arhiviran." : "Načrt je ponovno aktiven." };
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function createLocationAction(
  organizationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["locationName"]);
  const parsed = locationNameSchema.safeParse(values.locationName);
  if (!parsed.success)
    return { status: "error", fieldErrors: { locationName: parsed.error.issues[0]?.message }, values };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.manage");
    const { error } = await supabase.from("locations").insert({ organization_id: organizationId, name: parsed.data });
    if (error) {
      if (error.code === "23505") {
        return { status: "error", values, fieldErrors: { locationName: "Lokacija s tem imenom že obstaja." } };
      }
      return failure(error, values);
    }
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Lokacija je dodana." };
}

export async function updateLocationAction(
  organizationId: string,
  locationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["locationName"]);
  const parsed = locationNameSchema.safeParse(values.locationName);
  const version = versionSchema.safeParse(formData.get("version"));
  if (!parsed.success)
    return { status: "error", fieldErrors: { locationName: parsed.error.issues[0]?.message }, values };
  if (!version.success || !isUuid(locationId)) return { status: "error", message: "Neveljaven zahtevek.", values };
  const archive = formData.get("intent") === "archive";
  const restore = formData.get("intent") === "restore";
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.manage");
    const update: Record<string, unknown> = { name: parsed.data };
    if (archive) update.archived_at = new Date().toISOString();
    if (restore) update.archived_at = null;
    const { data, error } = await supabase
      .from("locations")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", locationId)
      .eq("version", version.data)
      .select("id");
    if (error) {
      if (error.code === "23505") {
        return { status: "error", values, fieldErrors: { locationName: "Lokacija s tem imenom že obstaja." } };
      }
      return failure(error, values);
    }
    if (!data?.length)
      return { ...(await conflictOrForbidden(supabase, "locations", organizationId, locationId)), values };
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return {
    status: "success",
    message: archive ? "Lokacija je arhivirana." : restore ? "Lokacija je obnovljena." : "Lokacija je preimenovana.",
  };
}

// ---------------------------------------------------------------------------
// CSV import (preview, then confirm; the confirm step validates again)
// ---------------------------------------------------------------------------

export interface ImportPreviewState extends ActionState {
  csv?: string;
  fileName?: string;
  preview?: { name: string; category: string; assetTag: string | null; location: string | null }[];
  rowCount?: number;
  issues?: { line: number; column?: string; message: string }[];
  issueCount?: number;
  imported?: number;
}

async function validateForOrg(supabase: SupabaseClient, organizationId: string, csv: string) {
  const existing = await getExistingIdentifiers(supabase, organizationId);
  return validateEquipmentCsv(csv, existing);
}

export async function previewImportAction(
  organizationId: string,
  _previous: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Izberite datoteko CSV." };
  if (file.size > MAX_IMPORT_BYTES) return { status: "error", message: "Datoteka je večja od 1 MB." };
  if (!/\.csv$/i.test(file.name)) return { status: "error", message: "Datoteka mora imeti končnico .csv." };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.import");
    const csv = decodeCsvBytes(await file.arrayBuffer());
    const result = await validateForOrg(supabase, organizationId, csv);
    const fileName = file.name.slice(0, 120);
    if (result.issueCount > 0) {
      return {
        status: "error",
        message: "Datoteka vsebuje napake. Popravite jih in jo naložite znova; uvoženo ni bilo nič.",
        fileName,
        issues: result.issues,
        issueCount: result.issueCount,
      };
    }
    return {
      status: "success",
      message: `Pregled je pripravljen: ${result.rows.length} vrstic brez napak. Potrdite uvoz.`,
      csv,
      fileName,
      rowCount: result.rows.length,
      preview: result.rows.slice(0, 20).map((row) => ({
        name: row.name,
        category: row.category,
        assetTag: row.asset_tag,
        location: row.location,
      })),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmImportAction(
  organizationId: string,
  _previous: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  const csv = String(formData.get("csv") ?? "");
  if (!csv || csv.length > MAX_IMPORT_BYTES)
    return { status: "error", message: "Najprej naložite datoteko za pregled." };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "equipment.import");
    const result = await validateForOrg(supabase, organizationId, csv);
    if (result.issueCount > 0) {
      return {
        status: "error",
        message: "Podatki so se medtem spremenili in datoteka zdaj vsebuje napake. Uvoženo ni bilo nič.",
        issues: result.issues,
        issueCount: result.issueCount,
      };
    }
    const { data, error } = await supabase.rpc("import_equipment", { p_org: organizationId, p_rows: result.rows });
    if (error) return failure(error);
    refresh();
    return {
      status: "success",
      message: `Uvoz je končan. Število uvoženih zapisov: ${Number(data)}.`,
      imported: Number(data),
    };
  } catch (error) {
    return failure(error);
  }
}
