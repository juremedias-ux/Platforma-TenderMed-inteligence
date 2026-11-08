"use client";

import { Building2, CalendarClock, PlugZap } from "lucide-react";
import { documentTypeLabels, equipmentCategoryLabels } from "@/features/equipment/labels";
import { attributeLabels, capabilityLabels } from "@/features/tenders/rules";
import { ILLUSTRATIVE_TENDER_NOTICE, NO_LIVE_SOURCES_NOTICE } from "@/data/demo/notices";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import type { SupplierAttribute, SupplierCapability, Tender, TenderMatchResult } from "@/types/domain";
import { useDemo } from "./demo-context";
import { Panel } from "./demo-shared";
import { RequirementStatusBadge, TenderLabelBadge } from "./status-badges";

export function TendersView() {
  const { snapshot } = useDemo();
  const { dataset, tenderMatches } = snapshot;
  const supplier = dataset.supplier;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-info-200 bg-info-50 p-4 text-sm leading-relaxed text-info-700">
        <PlugZap className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{NO_LIVE_SOURCES_NOTICE}</p>
          <p className="mt-1">
            Zavihek prikazuje predvideni pogled dobavitelja. Zahteve so primerjane s profilom izmišljenega dobavitelja »
            {supplier.name}«. Končno presojo izpolnjevanja pogojev vedno opravi človek.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <ul className="space-y-5">
          {dataset.tenders.map((tender) => {
            const match = tenderMatches.find((m) => m.tenderId === tender.id);
            return match ? (
              <li key={tender.id}>
                <TenderCard tender={tender} match={match} />
              </li>
            ) : null;
          })}
        </ul>

        <Panel title="Profil dobavitelja" description={`${supplier.name} · izmišljen`} className="self-start">
          <h4 className="text-xs font-semibold text-ink-muted">Navedene zmožnosti</h4>
          <ul className="mt-2 space-y-1.5 text-[13px] text-ink-soft">
            {(Object.keys(capabilityLabels) as SupplierCapability[]).map((capability) => {
              const value = supplier.capabilities[capability];
              return (
                <li key={capability} className="flex justify-between gap-3">
                  <span>{capabilityLabels[capability]}</span>
                  <span className="shrink-0 font-medium text-ink">
                    {value === true ? "da" : value === false ? "ne" : "ni navedeno"}
                  </span>
                </li>
              );
            })}
            {(Object.keys(attributeLabels) as SupplierAttribute[]).map((attribute) => {
              const value = supplier.attributes[attribute];
              return (
                <li key={attribute} className="flex justify-between gap-3">
                  <span>{attributeLabels[attribute].label}</span>
                  <span className="shrink-0 font-medium text-ink">
                    {value === undefined ? "ni navedeno" : `${value} ${attributeLabels[attribute].unit}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <h4 className="mt-4 text-xs font-semibold text-ink-muted">Dokumenti v profilu</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-ink-soft">
            {supplier.documentTypes.map((type) => (
              <li key={type}>{documentTypeLabels[type]}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function TenderCard({ tender, match }: { tender: Tender; match: TenderMatchResult }) {
  const { state } = useDemo();
  return (
    <article
      aria-labelledby={`${tender.id}-naslov`}
      className="overflow-hidden rounded-lg border border-line bg-surface shadow-card"
    >
      <p className="border-b border-warning-200 bg-warning-50 px-4 py-2 text-[13px] font-semibold text-warning-700 sm:px-5">
        {ILLUSTRATIVE_TENDER_NOTICE}
      </p>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`${tender.id}-naslov`} className="font-display text-lg font-semibold text-ink">
              {tender.title}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden="true" />
                {tender.buyerName} (izmišljen naročnik)
              </span>
              <span>{equipmentCategoryLabels[tender.equipmentCategory]}</span>
            </p>
          </div>
          <TenderLabelBadge label={match.label} />
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
          <CalendarClock className="size-4 text-ink-muted" aria-hidden="true" />
          Rok za oddajo ponudb: <time dateTime={tender.deadline}>{formatDate(tender.deadline)}</time>
          <span className="text-ink-muted">({describeDeadline(tender.deadline, state.referenceDate)})</span>
        </p>

        <div className="mt-4 overflow-hidden rounded-md border border-line">
          <table className="hidden w-full text-left text-sm sm:table">
            <caption className="sr-only">Zahteve razpisa in rezultat primerjave</caption>
            <thead className="bg-subtle text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Zahteva
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rezultat
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Pojasnilo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tender.requirements.map((requirement) => {
                const result = match.requirements.find((r) => r.requirementId === requirement.id)!;
                return (
                  <tr key={requirement.id}>
                    <th scope="row" className="px-3 py-2.5 align-top font-medium text-ink">
                      {requirement.description}
                    </th>
                    <td className="px-3 py-2.5 align-top">
                      <RequirementStatusBadge status={result.status} />
                    </td>
                    <td className="px-3 py-2.5 align-top text-[13px] text-ink-soft">{result.explanation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="divide-y divide-line sm:hidden">
            {tender.requirements.map((requirement) => {
              const result = match.requirements.find((r) => r.requirementId === requirement.id)!;
              return (
                <li key={requirement.id} className="space-y-1.5 p-3">
                  <p className="text-sm font-medium text-ink">{requirement.description}</p>
                  <RequirementStatusBadge status={result.status} />
                  <p className="text-[13px] text-ink-soft">{result.explanation}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-subtle p-3 text-[13px] leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Razlaga ujemanja</p>
            <p className="mt-1">{match.summary}</p>
          </div>
          <div className="rounded-md bg-subtle p-3 text-[13px] leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Manjkajoči dokazi</p>
            {match.missingEvidence.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {match.missingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">Ni zabeleženih manjkajočih dokazov.</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Objavljeno {formatDate(tender.publishedOn)} · vir objave ni povezan (ponazoritev)
        </p>
      </div>
    </article>
  );
}
