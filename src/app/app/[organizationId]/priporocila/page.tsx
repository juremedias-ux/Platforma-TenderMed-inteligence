import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeedbackButtons, InquiryDialog } from "@/components/app/catalog/catalog-forms";
import { ProductDetails } from "@/components/app/catalog/product-details";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { addDays } from "@/lib/dates/date-only";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { listFeedback, listProducts, listSuppliers } from "@/lib/repositories/catalog";
import { listAgenda } from "@/lib/repositories/equipment";
import {
  SERVICE_WINDOW_DAYS,
  WARRANTY_WINDOW_DAYS,
  buildRecommendations,
  type EquipmentFact,
} from "@/lib/recommendations/engine";

export const metadata: Metadata = { title: "Priporočila" };

type Props = PageProps<"/app/[organizationId]/priporocila">;

const ruleTitles = {
  compatible: "Združljivo z vašo opremo",
  service_due: "Storitev za bližnje ali zamujene roke",
  warranty_end: "Garancija se izteka",
};

async function Recommendations({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/priporocila`);
  if (!context) return <NoAccess />;
  const { supabase, role } = context;
  const query = await searchParams;
  const showHidden = query.prikaz === "skrita";
  const today = ljubljanaDate();

  let loaded;
  try {
    const [equipmentResult, agenda, products, suppliers, feedback] = await Promise.all([
      supabase
        .from("equipment")
        .select("id, name, category, manufacturer_name, model, warranty_end_date, status")
        .eq("organization_id", organizationId)
        .neq("status", "archived")
        .limit(5000),
      listAgenda(supabase, organizationId, addDays(today, SERVICE_WINDOW_DAYS), 5000),
      listProducts(supabase, { publishedOnly: true }),
      listSuppliers(supabase),
      listFeedback(supabase, organizationId),
    ]);
    if (equipmentResult.error) throw equipmentResult.error;
    loaded = { equipment: (equipmentResult.data ?? []) as EquipmentFact[], agenda, products, suppliers, feedback };
  } catch {
    return <LoadError />;
  }
  const supplierById = new Map(loaded.suppliers.map((s) => [s.organization_id, s]));
  const products = loaded.products.filter(
    (p) => supplierById.has(p.supplier_organization_id) && p.supplier_organization_id !== organizationId,
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const all = buildRecommendations({
    equipment: loaded.equipment,
    dueDates: loaded.agenda.map((a) => ({ equipment_id: a.equipment_id, next_due_date: a.next_due_date })),
    products,
    today,
  });
  const statusOf = (r: (typeof all)[number]) => loaded.feedback.get(`${r.productId}|${r.ruleKey}`) ?? null;
  const visible = all.filter((r) => (showHidden ? statusOf(r) === "dismissed" : statusOf(r) !== "dismissed"));
  const hiddenCount = all.filter((r) => statusOf(r) === "dismissed").length;
  const equipmentOptions = loaded.equipment.map((e) => ({
    id: e.id,
    label: [e.name, e.manufacturer_name, e.model].filter(Boolean).join(" · "),
  }));
  const canAct = can(role, "recommendations.feedback");
  const canInquire = can(role, "supplier.inquire");

  return (
    <>
      <PageHeader
        title="Priporočila"
        description={`Izračunana iz vašega registra opreme in objavljenega kataloga odobrenih dobaviteljev po fiksnih pravilih: združljivost z modeli vaše opreme, storitve za roke v ${SERVICE_WINDOW_DAYS} dneh ali zamujene roke, storitve ob izteku garancije v ${WARRANTY_WINDOW_DAYS} dneh. Plačane objave ne vplivajo na vrstni red.`}
        actions={
          hiddenCount > 0 || showHidden ? (
            <Link
              href={`/app/${organizationId}/priporocila${showHidden ? "" : "?prikaz=skrita"}`}
              className="text-sm font-medium text-accent-700 hover:underline"
            >
              {showHidden ? "Nazaj na priporočila" : `Skrita priporočila (${hiddenCount})`}
            </Link>
          ) : null
        }
      />
      {visible.length === 0 ? (
        <StateMessage kind="empty" title={showHidden ? "Ni skritih priporočil" : "Trenutno ni priporočil"}>
          {showHidden
            ? "Skrita priporočila bodo prikazana tukaj."
            : products.length === 0
              ? "V katalogu še ni objavljenih izdelkov odobrenih dobaviteljev, zato priporočil ni mogoče izračunati."
              : "Noben objavljen izdelek ne ustreza pravilom glede na vašo opremo in roke."}
        </StateMessage>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => {
            const product = productById.get(r.productId)!;
            const supplier = supplierById.get(product.supplier_organization_id)!;
            return (
              <li key={`${r.productId}|${r.ruleKey}`}>
                <ProductDetails product={product} supplier={supplier}>
                  <div>
                    <p className="text-sm font-medium text-ink">Zakaj: {ruleTitles[r.rule]}</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
                      {r.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {canAct ? (
                      <FeedbackButtons
                        organizationId={organizationId}
                        productId={r.productId}
                        ruleKey={r.ruleKey}
                        status={statusOf(r)}
                      />
                    ) : null}
                    {canInquire ? (
                      <InquiryDialog
                        organizationId={organizationId}
                        product={{
                          id: product.id,
                          name: product.name,
                          supplierId: supplier.organization_id,
                          supplierName: supplier.name,
                        }}
                        ruleKey={r.ruleKey}
                        equipment={equipmentOptions}
                        defaultEquipmentIds={r.equipmentIds}
                      />
                    ) : null}
                  </div>
                </ProductDetails>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function RecommendationsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam priporočila …</p>}>
      <Recommendations params={params} searchParams={searchParams} />
    </Suspense>
  );
}
