import { AuthorizationError, requireOrgPermission } from "@/lib/auth/session";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { equipmentToCsv, type EquipmentExportRow } from "@/lib/equipment/csv-format";

/**
 * CSV export of the equipment register (RLS applies through the user's
 * session). Archived equipment is included only with ?arhiv=1. Cells that a
 * spreadsheet would evaluate as formulas are neutralized in toCsv().
 */
export async function GET(request: Request, { params }: RouteContext<"/app/[organizationId]/oprema/izvoz">) {
  const { organizationId } = await params;
  let supabase;
  try {
    ({ supabase } = await requireOrgPermission(organizationId, "equipment.export"));
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Dostop ni dovoljen.", { status: 403 });
    throw error;
  }
  const includeArchived = new URL(request.url).searchParams.get("arhiv") === "1";
  const rows: EquipmentExportRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("equipment_overview")
      .select(
        "asset_tag, name, category, manufacturer_name, model, serial_number, location_name, purchase_date, commissioning_date, warranty_end_date, status, notes, next_due_date",
      )
      .eq("organization_id", organizationId);
    if (!includeArchived) query = query.neq("status", "archived");
    const { data, error } = await query
      .order("name")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) return new Response("Izvoz ni uspel. Poskusite znova.", { status: 500 });
    rows.push(...((data ?? []) as EquipmentExportRow[]));
    if (!data || data.length < pageSize) break;
  }
  return new Response(equipmentToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oprema-${ljubljanaDate()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
