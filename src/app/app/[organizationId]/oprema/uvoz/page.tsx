import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportForm } from "@/components/app/equipment/import-form";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess, StateMessage } from "@/components/app/state-message";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { equipmentCsvColumns } from "@/lib/equipment/csv-format";
import { equipmentCategories, equipmentCategoryLabels } from "@/lib/equipment/domain";

export const metadata: Metadata = { title: "Uvoz opreme" };

type Props = PageProps<"/app/[organizationId]/oprema/uvoz">;

const columnHelp: Record<string, string> = {
  inventarna_stevilka: "Neobvezno; enolična v organizaciji.",
  naziv: "Obvezno.",
  kategorija: "Obvezno; koda ali ime kategorije (glej spodaj).",
  proizvajalec: "Neobvezno.",
  model: "Neobvezno.",
  serijska_stevilka: "Neobvezno; enolična za istega proizvajalca.",
  lokacija: "Neobvezno; manjkajoča lokacija bo ustvarjena.",
  datum_nakupa: "2026-01-31 ali 31. 1. 2026.",
  datum_zagona: "2026-01-31 ali 31. 1. 2026.",
  garancija_do: "2026-01-31 ali 31. 1. 2026.",
  status: "V uporabi (privzeto), Na servisu ali Začasno izven uporabe.",
  opombe: "Neobvezno.",
};

async function ImportPage({ params }: Pick<Props, "params">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/oprema/uvoz`);
  if (!context) return <NoAccess />;
  const breadcrumbs = [{ href: `/app/${organizationId}/oprema`, label: "Oprema" }, { label: "Uvoz" }];
  if (!can(context.role, "equipment.import")) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="Uvoz opreme" />
        <StateMessage kind="forbidden" title="Uvoz ni dovoljen">
          Opremo lahko uvažajo lastniki, skrbniki in upravljavci opreme.
        </StateMessage>
      </>
    );
  }
  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Uvoz opreme iz CSV"
        description="Datoteko najprej preverimo. Če vsebuje napako, ne uvozimo ničesar."
        actions={
          <a href={`/app/${organizationId}/oprema/uvoz/predloga`} className={buttonVariants({ variant: "secondary" })}>
            <Download aria-hidden="true" />
            Prenesi predlogo
          </a>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
          <ImportForm organizationId={organizationId} />
        </section>
        <aside className="space-y-4 text-sm">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <h2 className="font-semibold text-ink">Stolpci</h2>
            <p className="mt-1 text-ink-muted">
              Prva vrstica so imena stolpcev. Ločilo je podpičje ali vejica; kodiranje UTF-8 ali Windows-1250.
            </p>
            <dl className="mt-3 space-y-2">
              {equipmentCsvColumns.map((column) => (
                <div key={column.header}>
                  <dt className="font-mono text-xs text-ink">{column.header}</dt>
                  <dd className="text-ink-muted">{columnHelp[column.header]}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <h2 className="font-semibold text-ink">Kategorije</h2>
            <ul className="mt-2 space-y-1">
              {equipmentCategories.map((code) => (
                <li key={code}>
                  <span className="font-mono text-xs">{code}</span>{" "}
                  <span className="text-ink-muted">– {equipmentCategoryLabels[code]}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function EquipmentImportPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam …</p>}>
      <ImportPage params={params} />
    </Suspense>
  );
}
