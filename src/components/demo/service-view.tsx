"use client";

import { ArrowLeft, CalendarCheck, CalendarPlus, CircleAlert, Info, Plus, Replace } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/form-controls";
import { serviceEventTypeLabels } from "@/features/equipment/labels";
import { sortRequestsForDisplay } from "@/features/demo/selectors";
import { statusChangeBlocker } from "@/features/demo/state";
import {
  issueCategoryLabels,
  serviceRequestStatusLabels,
  serviceRequestStatusOrder,
  timelineActorLabels,
  urgencyLabels,
} from "@/features/service/labels";
import { compareIsoDates, isValidIsoDate } from "@/lib/dates/date-only";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import { cn } from "@/lib/utils/cn";
import type { ServiceRequest, ServiceRequestStatus, ServiceTimelineEvent } from "@/types/domain";
import { CompletionDialog } from "./completion-dialog";
import { useDemo } from "./demo-context";
import { EmptyState, KeyValueList, Panel, SerialNumber } from "./demo-shared";
import { ServiceRequestStatusBadge } from "./status-badges";

function timelineText(event: ServiceTimelineEvent): string {
  switch (event.kind) {
    case "created":
      return "Zahtevek ustvarjen";
    case "status_changed":
      return `Status spremenjen v »${event.status ? serviceRequestStatusLabels[event.status] : "—"}«`;
    case "appointment_proposed":
      return `Predlagan termin: ${event.appointment ? formatDate(event.appointment) : "—"}`;
    case "appointment_confirmed":
      return `Potrjen termin: ${event.appointment ? formatDate(event.appointment) : "—"}`;
    case "completion_recorded":
      return "Zabeležena izvedba vzdrževanja";
    case "note":
      return event.note ?? "";
  }
}

export function ServiceView({
  selectedRequestId,
  onSelectRequest,
}: {
  selectedRequestId: string | null;
  onSelectRequest: (id: string | null) => void;
}) {
  const { snapshot, state, openNewRequest } = useDemo();
  const requests = sortRequestsForDisplay(state.serviceRequests);
  // Without an explicit selection, the desktop detail pane shows the most recent open request.
  const selected =
    requests.find((r) => r.id === selectedRequestId) ??
    requests.find((r) => r.status !== "closed") ??
    requests[0] ??
    null;
  const [mobileDetail, setMobileDetail] = useState(Boolean(selectedRequestId));

  const select = (id: string) => {
    onSelectRequest(id);
    setMobileDetail(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Zahtevki: {requests.length} · odprti: {requests.filter((r) => r.status !== "closed").length}
        </p>
        <Button onClick={() => openNewRequest()}>
          <Plus aria-hidden="true" />
          Nov servisni zahtevek
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className={cn(mobileDetail && selected ? "hidden lg:block" : "block")}>
          <ul className="space-y-2" aria-label="Servisni zahtevki">
            {requests.map((request) => {
              const equipment = snapshot.dataset.equipment.find((e) => e.id === request.equipmentId);
              const isSelected = request.id === selected?.id;
              return (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => select(request.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "w-full rounded-lg border bg-surface p-4 text-left shadow-card transition-colors",
                      isSelected ? "border-navy-900 ring-1 ring-navy-900" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">
                          {equipment?.name} {equipment?.model}
                        </span>
                        <span className="block text-[13px] text-ink-muted">
                          {issueCategoryLabels[request.issueCategory]}
                        </span>
                      </span>
                      <ServiceRequestStatusBadge status={request.status} size="sm" />
                    </span>
                    <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>Odprto: {formatDate(request.createdOn)}</span>
                      {request.confirmedAppointment ? (
                        <span>Potrjen termin: {formatDate(request.confirmedAppointment)}</span>
                      ) : request.proposedAppointment ? (
                        <span>Predlagan termin: {formatDate(request.proposedAppointment)}</span>
                      ) : (
                        <span>Termin ni predlagan</span>
                      )}
                      {request.urgency === "high" ? (
                        <span className="font-medium text-danger-700">Visoka nujnost</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={cn(mobileDetail && selected ? "block" : "hidden lg:block")}>
          {selected ? (
            <>
              <Button variant="ghost" size="sm" className="mb-3 lg:hidden" onClick={() => setMobileDetail(false)}>
                <ArrowLeft aria-hidden="true" />
                Nazaj na seznam
              </Button>
              <RequestDetail key={selected.id} request={selected} />
            </>
          ) : (
            <EmptyState
              title="Izberite servisni zahtevek"
              text="Izberite zahtevek na seznamu ali odprite novega za napravo iz evidence."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ request }: { request: ServiceRequest }) {
  const id = useId();
  const { snapshot, state, dispatch, announce, openEquipment } = useDemo();
  const { dataset } = snapshot;
  const equipment = dataset.equipment.find((e) => e.id === request.equipmentId)!;
  const partner = dataset.partners.find((p) => p.id === request.servicePartnerId);
  const completion = request.completionEventId
    ? state.serviceEvents.find((e) => e.id === request.completionEventId)
    : undefined;
  const [proposal, setProposal] = useState("");
  const [proposalError, setProposalError] = useState<string | null>(null);
  const closed = request.status === "closed";
  const canConfirm =
    Boolean(request.proposedAppointment) && request.confirmedAppointment !== request.proposedAppointment && !closed;

  function propose() {
    if (!isValidIsoDate(proposal)) return setProposalError("Vnesite veljaven datum.");
    if (compareIsoDates(proposal, state.referenceDate) < 0)
      return setProposalError("Termin ne sme biti v preteklosti.");
    setProposalError(null);
    dispatch({ type: "propose_appointment", requestId: request.id, date: proposal });
    setProposal("");
    announce(`Predlagan je termin ${formatDate(proposal)}. Termin še ni potrjen.`);
  }

  function confirm() {
    dispatch({ type: "confirm_appointment", requestId: request.id });
    announce(`Termin ${request.proposedAppointment ? formatDate(request.proposedAppointment) : ""} je potrjen.`);
  }

  function changeStatus(status: ServiceRequestStatus) {
    if (statusChangeBlocker(request, status)) return;
    dispatch({ type: "change_status", requestId: request.id, status });
    announce(`Status zahtevka je spremenjen v »${serviceRequestStatusLabels[status]}«.`);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Servisni zahtevek · odprto {formatDate(request.createdOn)}</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">
              {equipment.name} {equipment.model}
            </h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              <SerialNumber>{equipment.serialNumber}</SerialNumber>
            </p>
          </div>
          <ServiceRequestStatusBadge status={request.status} />
        </div>
        <KeyValueList
          className="mt-5"
          items={[
            { label: "Vrsta težave", value: issueCategoryLabels[request.issueCategory] },
            { label: "Nujnost", value: urgencyLabels[request.urgency] },
            { label: "Serviser", value: partner ? `${partner.name} (izmišljen)` : "Še ni dodeljen" },
            {
              label: "Nadomestna oprema",
              value: request.replacementEquipmentRequested ? "Zahtevana" : "Ni zahtevana",
            },
          ]}
        />
        {request.replacementEquipmentRequested ? (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-ink-muted">
            <Replace className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Zagotovitev nadomestne opreme je odvisna od ponudnika in pogodbenega dogovora.
          </p>
        ) : null}
        <Button variant="ghost" size="sm" className="mt-3 -ml-3" onClick={() => openEquipment(equipment.id)}>
          Podrobnosti naprave
        </Button>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Termin" description="Predlog termina in potrditev sta ločena koraka.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Predlagan termin</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {request.proposedAppointment ? (
                  <>
                    {formatDate(request.proposedAppointment)}
                    <span className="block text-xs font-normal text-ink-muted">
                      {describeDeadline(request.proposedAppointment, state.referenceDate)}
                    </span>
                  </>
                ) : (
                  "Ni predlagan"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Potrjen termin</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {request.confirmedAppointment ? formatDate(request.confirmedAppointment) : "Še ni potrjen"}
              </dd>
            </div>
          </dl>

          {!closed ? (
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              <div>
                <Label htmlFor={`${id}-predlog`} className="text-[13px]">
                  Predlagaj nov termin
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id={`${id}-predlog`}
                    type="date"
                    min={state.referenceDate}
                    value={proposal}
                    onChange={(e) => setProposal(e.target.value)}
                    className="h-9 text-sm"
                    aria-invalid={Boolean(proposalError)}
                    aria-describedby={proposalError ? `${id}-predlog-napaka` : undefined}
                  />
                  <Button variant="secondary" size="md" className="h-9" onClick={propose} disabled={!proposal}>
                    <CalendarPlus aria-hidden="true" />
                    Predlagaj
                  </Button>
                </div>
                <FieldError id={`${id}-predlog-napaka`}>{proposalError}</FieldError>
              </div>
              <div>
                <Button size="sm" onClick={confirm} disabled={!canConfirm}>
                  <CalendarCheck aria-hidden="true" />
                  Potrdi predlagani termin
                </Button>
                <p className="mt-1.5 text-xs text-ink-muted">
                  V demonstraciji potrditev simulira odgovor serviserja.
                  {request.confirmedAppointment && request.confirmedAppointment === request.proposedAppointment
                    ? " Predlagani termin je že potrjen."
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Status zahtevka">
          <Label htmlFor={`${id}-status`} className="text-[13px]">
            Spremeni status
          </Label>
          <Select
            id={`${id}-status`}
            className="mt-1.5"
            value={request.status}
            onChange={(e) => changeStatus(e.target.value as ServiceRequestStatus)}
            aria-describedby={`${id}-status-namig`}
          >
            {serviceRequestStatusOrder.map((status) => {
              const blocker = statusChangeBlocker(request, status);
              return (
                <option key={status} value={status} disabled={Boolean(blocker) && status !== request.status}>
                  {serviceRequestStatusLabels[status]}
                  {blocker && status !== request.status ? ` – ${blocker.toLowerCase().replace(/\.$/, "")}` : ""}
                </option>
              );
            })}
          </Select>
          <p id={`${id}-status-namig`} className="mt-2 text-xs leading-relaxed text-ink-muted">
            »Termin potrjen« in »V izvedbi« sta mogoča šele po potrditvi termina. Zaključek zahtevka ne pomeni samodejne
            evidence izvedenega vzdrževanja.
          </p>
        </Panel>
      </div>

      <Panel title="Izvedba vzdrževanja" description="Evidenca izvedbe se vodi ločeno od statusa zahtevka.">
        {completion ? (
          <div className="flex items-start gap-3">
            <Badge tone="success" size="sm">
              Zabeleženo
            </Badge>
            <p className="text-sm text-ink-soft">
              {formatDate(completion.date)} · {completion.types.map((t) => serviceEventTypeLabels[t]).join(", ")}
              <span className="block text-xs text-ink-muted">{completion.summary}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-start gap-2 text-sm text-ink-soft">
              {closed ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden="true" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              )}
              {closed ? "Zahtevek je zaključen, izvedba vzdrževanja pa ni zabeležena." : "Izvedba še ni zabeležena."}
            </p>
            <CompletionDialog request={request} />
          </div>
        )}
      </Panel>

      <Panel title="Časovnica usklajevanja" description="Izmišljen potek dogovora in vaša dejanja v demonstraciji.">
        <ol className="relative space-y-4 border-l border-line pl-5">
          {[...request.timeline].reverse().map((event) => (
            <li key={event.id} className="relative">
              <span
                className={cn(
                  "absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface",
                  event.actor === "service_partner"
                    ? "bg-accent-500"
                    : event.actor === "system"
                      ? "bg-navy-300"
                      : "bg-navy-900",
                )}
                aria-hidden="true"
              />
              <p className="text-xs text-ink-muted">
                <time dateTime={event.date}>{formatDate(event.date)}</time> · {timelineActorLabels[event.actor]}
              </p>
              <p className="text-sm text-ink">{timelineText(event)}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
