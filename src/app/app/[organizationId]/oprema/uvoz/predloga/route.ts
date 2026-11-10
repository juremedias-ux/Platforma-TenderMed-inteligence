import { AuthorizationError, requireOrgPermission } from "@/lib/auth/session";
import { equipmentCsvTemplate } from "@/lib/equipment/csv-format";

export async function GET(_request: Request, { params }: RouteContext<"/app/[organizationId]/oprema/uvoz/predloga">) {
  const { organizationId } = await params;
  try {
    await requireOrgPermission(organizationId, "equipment.import");
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Dostop ni dovoljen.", { status: 403 });
    throw error;
  }
  return new Response(equipmentCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="predloga-uvoz-opreme.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
