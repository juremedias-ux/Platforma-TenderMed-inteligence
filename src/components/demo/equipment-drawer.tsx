"use client";

import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { getEquipmentServiceStatus, evaluatePlans } from "@/features/equipment/maintenance";
import {
  activityTypeLabels,
  documentOriginLabels,
  documentTypeLabels,
  scheduleBasisLabels,
  serviceEventTypeLabels,
} from "@/features/equipment/labels";
import { sortRequestsForDisplay } from "@/features/demo/selectors";
import { issueCategoryLabels } from "@/features/service/labels";
import { compareIsoDates, diffInDays } from "@/lib/dates/date-only";
import { daysAccusative, formatDate } from "@/lib/dates/format";
import { formatEur } from "@/lib/utils/format-number";
import { countYears } from "@/lib/utils/plural";
import { useDemo } from "./demo-context";
import { DateWithRelative, DemoTag, KeyValueList, SerialNumber } from "./demo-shared";
import { EquipmentStatusBadge, MaintenanceStatusBadge, ServiceRequestStatusBadge } from "./status-badges";

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{children}</h3>;
}

export function EquipmentDrawer({ equipmentId, onClose }: { equipmentId: string | null; onClose: () => void }) {
  const { snapshot } = useDemo();
  const equipment = equipmentId ? snapshot.dataset.equipment.find((e) => e.id === equipmentId) : undefined;

  return (
    <Dialog open={Boolean(equipment)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      {equipment ? (
        <SheetContent closeLabel="Zapri podrobnosti naprave">
          <EquipmentDetails equipmentId={equipment.id} onClose={onClose} />
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function EquipmentDetails({ equipmentId: id, onClose: close }: { equipmentId: string; onClose: () => void }) {
  const { snapshot, state, navigate: go, openNewRequest: openRequest } = useDemo();
  const { dataset } = snapshot;
  const item = dataset.equipment.find((e) => e.id === id)!;
  const reference = state.referenceDate;
  const manufacturer = dataset.manufacturers.find((m) => m.id === item.manufacturerId);
  const location = dataset.locations.find((l) => l.id === item.locationId);
  const partner = dataset.partners.find((p) => p.id === item.servicePartnerId);
  const plans = state.plans.filter((p) => p.equipmentId === item.id);
  const evaluated = evaluatePlans(plans, reference);
  const status = getEquipmentServiceStatus(plans, reference);
  const events = state.serviceEvents
    .filter((e) => e.equipmentId === item.id)
    .sort((a, b) => compareIsoDates(b.date, a.date));
  const requests = sortRequestsForDisplay(state.serviceRequests.filter((r) => r.equipmentId === item.id));
  const documents = dataset.documents.filter((d) => d.equipmentId === item.id);
  const recordedCosts = events.filter((e) => e.costEur !== null).reduce((sum, e) => sum + (e.costEur ?? 0), 0);
  const warrantyDays = diffInDays(reference, item.warrantyEndDate);
  const documentTitle = (documentId?: string) => dataset.documents.find((d) => d.id === documentId)?.title;

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <DemoTag>izmišljena naprava</DemoTag>
          <EquipmentStatusBadge status={status} size="sm" />
        </div>
        <DialogTitle className="mt-3">
          {item.name} {item.model}
        </DialogTitle>
        <DialogDescription className="mt-1">
          {manufacturer?.name} (izmišljen proizvajalec) · <SerialNumber>{item.serialNumber}</SerialNumber>
        </DialogDescription>
        <Button
          className="mt-4"
          size="sm"
          onClick={() => {
            close();
            openRequest(item.id);
          }}
        >
          <Plus aria-hidden="true" />
          Odpri servisni zahtevek
        </Button>
      </div>

      <div className="space-y-8 px-6 py-6">
        <section className="space-y-3">
          <SectionHeading>Osnovni podatki</SectionHeading>
          <KeyValueList
            items={[
              {
                label: "Proizvajalec",
                value: `${manufacturer?.name ?? "—"} (izmišljen)`,
              },
              { label: "Model", value: item.model },
              {
                label: "Serijska številka",
                value: <SerialNumber>{item.serialNumber}</SerialNumber>,
              },
              { label: "Lokacija", value: location?.name ?? "—" },
              { label: "Datum nakupa", value: formatDate(item.purchaseDate) },
              {
                label: "Garancija do",
                value: (
                  <>
                    {formatDate(item.warrantyEndDate)}
                    <span className="block text-xs font-normal text-ink-muted">
                      {warrantyDays >= 0
                        ? `še ${warrantyDays} ${daysAccusative(warrantyDays)}`
                        : "garancija je potekla"}
                    </span>
                  </>
                ),
              },
              {
                label: "Pričakovana življenjska doba",
                value: item.expectedServiceLifeYears
                  ? `${countYears(item.expectedServiceLifeYears)} (po navedbi proizvajalca)`
                  : "Ni zabeležena",
              },
              {
                label: "Serviser",
                value: partner ? `${partner.name} (izmišljen)` : "Ni določen",
              },
            ]}
          />
        </section>

        <section className="space-y-3">
          <SectionHeading>Servisni načrt</SectionHeading>
          {evaluated.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-3 text-sm text-ink-soft">
              Servisni interval ni določen. Preverite navodila proizvajalca in postopke ustanove ter ga vnesite v
              evidenco.
            </p>
          ) : (
            <ul className="space-y-3">
              {evaluated.map(({ plan, dueDate, status: planStatus }) => (
                <li key={plan.id} className="rounded-md border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{activityTypeLabels[plan.activityType]}</p>
                    <MaintenanceStatusBadge status={planStatus} size="sm" />
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-ink-muted">Rok</dt>
                      <dd className="text-ink">
                        <DateWithRelative date={dueDate} reference={reference} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Način določitve</dt>
                      <dd className="text-ink">
                        {plan.schedule.kind === "interval"
                          ? `Interval ${plan.schedule.intervalMonths} mes. od zadnje izvedbe (${formatDate(plan.schedule.lastCompletedDate)})`
                          : plan.schedule.dueDate
                            ? "Ročno vnesen rok"
                            : "Naslednji rok še ni vnesen"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Vir zahteve</dt>
                      <dd className="text-ink">
                        {scheduleBasisLabels[plan.source.basis]}
                        {plan.source.documentId ? (
                          <span className="block text-xs text-ink-muted">{documentTitle(plan.source.documentId)}</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Odgovornost</dt>
                      <dd className="text-ink">{plan.responsibleRole}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeading>Servisna zgodovina</SectionHeading>
            {events.length > 0 ? (
              <p className="text-xs text-ink-muted">Zabeleženi stroški (demo): {formatEur(recordedCosts)}</p>
            ) : null}
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-ink-muted">Za to napravo ni zabeleženih servisnih posegov.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-accent-500"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-ink-muted">
                    <time dateTime={event.date}>{formatDate(event.date)}</time>
                    {event.createdInDemoSession ? " · zabeleženo v tej seji" : ""}
                  </p>
                  <p className="text-sm font-medium text-ink">
                    {event.types.map((t) => serviceEventTypeLabels[t]).join(", ")}
                  </p>
                  <p className="text-sm text-ink-soft">{event.summary}</p>
                  <p className="text-xs text-ink-muted">
                    {event.costEur !== null ? `Strošek: ${formatEur(event.costEur)}` : "Strošek ni vnesen"}
                    {event.servicePartnerId
                      ? ` · ${dataset.partners.find((p) => p.id === event.servicePartnerId)?.name ?? ""}`
                      : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading>Servisni zahtevki</SectionHeading>
          {requests.length === 0 ? (
            <p className="text-sm text-ink-muted">Za to napravo ni servisnih zahtevkov.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{issueCategoryLabels[request.issueCategory]}</p>
                    <p className="text-xs text-ink-muted">Odprto {formatDate(request.createdOn)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ServiceRequestStatusBadge status={request.status} size="sm" />
                    <Button variant="ghost" size="sm" onClick={() => go("servisi", { requestId: request.id })}>
                      Odpri
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading>Dokumentacija</SectionHeading>
          {documents.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-3 text-sm text-ink-soft">
              Za to napravo ni evidentiranih dokumentov, niti navodil za uporabo.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-start gap-3 p-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{doc.title}</p>
                    <p className="text-xs text-ink-muted">
                      {documentTypeLabels[doc.type]} · {documentOriginLabels[doc.origin]}
                      {doc.issuedOn ? ` · ${formatDate(doc.issuedOn)}` : ""}
                    </p>
                  </div>
                  <Badge tone="outline" size="sm">
                    Samo metapodatek
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">
            Demo prikazuje le metapodatke dokumentov. Datoteke niso shranjene in jih ni mogoče prenesti.
          </p>
        </section>
      </div>
    </div>
  );
}
