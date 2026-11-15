import type { Metadata } from "next";
import { Suspense } from "react";
import { AnswerInquiryForm, CloseInquiryButton } from "@/components/app/catalog/catalog-forms";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { inquiryStatusLabels } from "@/lib/catalog/domain";
import { formatDateTime } from "@/lib/dates/datetime";
import { equipmentCategories, equipmentCategoryLabels, isOneOf } from "@/lib/equipment/domain";
import { listInquiries, type InquiryRow } from "@/lib/repositories/catalog";

export const metadata: Metadata = { title: "Povpraševanja" };

type Props = PageProps<"/app/[organizationId]/katalog/povprasevanja">;

function InquiryCard({
  inquiry,
  incoming,
  children,
}: {
  inquiry: InquiryRow;
  incoming: boolean;
  children?: React.ReactNode;
}) {
  const snapshot = inquiry.shared_snapshot ?? {};
  return (
    <li className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{snapshot.product_name ?? "Izdelek"}</h3>
        <Badge
          size="sm"
          tone={inquiry.status === "sent" ? "warning" : inquiry.status === "answered" ? "success" : "outline"}
        >
          {inquiryStatusLabels[inquiry.status] ?? inquiry.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {incoming
          ? `Od: ${snapshot.organization_name ?? "organizacija"}`
          : `Za: ${snapshot.supplier_name ?? "dobavitelj"}`}{" "}
        · {formatDateTime(inquiry.created_at)}
      </p>
      <p className="mt-3 text-sm whitespace-pre-line text-ink">{inquiry.message}</p>
      {snapshot.equipment && snapshot.equipment.length > 0 ? (
        <div className="mt-3 text-sm">
          <p className="font-medium text-ink">Deljeni podatki o opremi</p>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {snapshot.equipment.map((e, index) => (
              <li key={index}>
                {[
                  e.name,
                  isOneOf(equipmentCategories, e.category) ? equipmentCategoryLabels[e.category] : e.category,
                  e.manufacturer_name,
                  e.model,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {snapshot.contact_email ? (
        <p className="mt-2 text-sm text-ink-soft">
          Kontakt: {snapshot.contact_name ? `${snapshot.contact_name}, ` : ""}
          {snapshot.contact_email}
        </p>
      ) : null}
      {inquiry.response_text ? (
        <div className="mt-3 rounded-md bg-subtle p-3 text-sm">
          <p className="text-xs text-ink-muted">
            Odgovor dobavitelja{inquiry.responded_at ? ` · ${formatDateTime(inquiry.responded_at)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-line text-ink">{inquiry.response_text}</p>
        </div>
      ) : null}
      {children ? <div className="mt-4 border-t border-line pt-4">{children}</div> : null}
    </li>
  );
}

async function Inquiries({ params }: Pick<Props, "params">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/katalog/povprasevanja`);
  if (!context) return <NoAccess />;
  let inquiries: InquiryRow[];
  try {
    inquiries = await listInquiries(context.supabase, organizationId);
  } catch {
    return <LoadError />;
  }
  const incoming = inquiries.filter((i) => i.supplier_organization_id === organizationId);
  const outgoing = inquiries.filter((i) => i.organization_id === organizationId);
  const canAnswer = can(context.role, "catalog.manage");
  const canClose = can(context.role, "supplier.inquire");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ href: `/app/${organizationId}/katalog`, label: "Katalog" }, { label: "Povpraševanja" }]}
        title="Povpraševanja"
        description="Dobavitelj vidi samo sporočilo in podatke, ki jih je pošiljatelj izrecno izbral ob pošiljanju."
      />
      <div className="space-y-8">
        {incoming.length > 0 ? (
          <section aria-labelledby="incoming" className="space-y-3">
            <h2 id="incoming" className="text-base font-semibold text-ink">
              Prejeta povpraševanja
            </h2>
            <ul className="space-y-4">
              {incoming.map((inquiry) => (
                <InquiryCard key={inquiry.id} inquiry={inquiry} incoming>
                  {canAnswer && inquiry.status !== "closed" ? (
                    <AnswerInquiryForm organizationId={organizationId} inquiryId={inquiry.id} />
                  ) : null}
                </InquiryCard>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="outgoing" className="space-y-3">
          <h2 id="outgoing" className="text-base font-semibold text-ink">
            Poslana povpraševanja
          </h2>
          {outgoing.length === 0 ? (
            <StateMessage kind="empty" title="Ni poslanih povpraševanj">
              Povpraševanje pošljete iz kataloga ali s strani priporočil.
            </StateMessage>
          ) : (
            <ul className="space-y-4">
              {outgoing.map((inquiry) => (
                <InquiryCard key={inquiry.id} inquiry={inquiry} incoming={false}>
                  {canClose && inquiry.status !== "closed" ? (
                    <CloseInquiryButton organizationId={organizationId} inquiryId={inquiry.id} />
                  ) : null}
                </InquiryCard>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function InquiriesPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam povpraševanja …</p>}>
      <Inquiries params={params} />
    </Suspense>
  );
}
