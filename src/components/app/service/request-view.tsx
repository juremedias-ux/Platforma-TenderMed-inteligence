import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDateTimeRange as formatRange } from "@/lib/dates/datetime";
import { formatDate } from "@/lib/dates/format";
import { equipmentCategoryLabels, isOneOf, equipmentCategories } from "@/lib/equipment/domain";
import type { CompletionRow, RequestBrief, ServiceRequestRow, getRequestThread } from "@/lib/repositories/service";
import {
  acknowledgmentLabels,
  availableTransitions,
  describeEvent,
  outcomeLabels,
  priorityLabels,
  proposalStatusLabels,
  replacementStatusLabels,
  requestTypeLabels,
  type Actor,
} from "@/lib/service/domain";
import { RequestStatusBadge } from "./badges";
import {
  AcknowledgeForms,
  CompletionForm,
  InviteAssigneeForm,
  MessageForm,
  ProposalActions,
  ProposeAppointmentForm,
  ReplacementControls,
  RevokeAssignmentButton,
  TransitionButtons,
  VoidCompletionDialog,
} from "./request-forms";

type Thread = Awaited<ReturnType<typeof getRequestThread>>;

export interface RequestViewProps {
  request: ServiceRequestRow;
  brief: RequestBrief;
  thread: Thread;
  names: Map<string, string>;
  actor: Actor;
  userId: string;
  today: string;
  /** Members only: link to the equipment record. */
  equipmentHref?: string;
  canAssign: boolean;
  canVoid: boolean;
}

function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function isActiveCompletion(c: CompletionRow) {
  return !c.voided_at && c.outcome !== "not_completed" && c.acknowledgment_status !== "rejected";
}

export function RequestView({
  request,
  brief,
  thread,
  names,
  actor,
  userId,
  today,
  equipmentHref,
  canAssign,
  canVoid,
}: RequestViewProps) {
  const name = (id: string | null) => (id ? (names.get(id) ?? "Nekdanji udeleženec") : "Sistem");
  const open = request.status !== "zakljuceno" && request.status !== "preklicano";
  const transitions = availableTransitions(request.status, actor);
  const canCoordinate = actor === "operator" || actor === "assignee";
  const canPropose = canCoordinate && (request.status === "novo" || request.status === "v_usklajevanju");
  const hasActive = thread.completions.some(isActiveCompletion);
  const canRecord =
    !hasActive &&
    ((actor === "operator" && ["novo", "v_usklajevanju", "termin_potrjen", "v_izvedbi"].includes(request.status)) ||
      (actor === "assignee" && ["termin_potrjen", "v_izvedbi"].includes(request.status)));
  const voided = thread.completions
    .filter((c) => c.voided_at)
    .map((c) => ({ id: c.id, label: `${formatDate(c.completed_on)} – ${outcomeLabels[c.outcome]}` }));
  const category = isOneOf(equipmentCategories, brief.equipment_category)
    ? equipmentCategoryLabels[brief.equipment_category]
    : brief.equipment_category;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Card title="Stanje" id="state">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <RequestStatusBadge status={request.status} />
            <span className="text-ink-soft">
              {request.scheduled_start && request.scheduled_end
                ? `Termin: ${formatRange(request.scheduled_start, request.scheduled_end)}`
                : "Termin ni potrjen"}
            </span>
          </div>
          {request.cancel_reason ? (
            <p className="mt-3 text-sm text-ink-soft">Razlog preklica: {request.cancel_reason}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
            <span className="text-ink-soft">
              Nadomestna oprema:{" "}
              <span className="font-medium text-ink">{replacementStatusLabels[request.replacement_status]}</span>
            </span>
            {open && canCoordinate ? (
              <ReplacementControls
                requestId={request.id}
                version={request.version}
                status={request.replacement_status}
              />
            ) : null}
          </div>
          {transitions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <TransitionButtons requestId={request.id} version={request.version} transitions={transitions} />
            </div>
          ) : null}
        </Card>

        <Card title="Termini" id="appointments">
          {thread.proposals.length === 0 ? (
            <p className="text-sm text-ink-muted">Ni predlaganih terminov.</p>
          ) : (
            <ul className="divide-y divide-line">
              {thread.proposals.map((proposal) => {
                const pending = proposal.status === "proposed" && canPropose;
                const mine = proposal.proposed_by === userId;
                const canDecide =
                  pending &&
                  !mine &&
                  (actor === "operator" || (actor === "assignee" && proposal.proposed_as === "member"));
                return (
                  <li
                    key={proposal.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="text-sm">
                      <p className="font-medium text-ink">{formatRange(proposal.starts_at, proposal.ends_at)}</p>
                      <p className="text-ink-muted">
                        {name(proposal.proposed_by)} · {proposalStatusLabels[proposal.status] ?? proposal.status}
                      </p>
                      {proposal.note ? <p className="mt-1 text-ink-soft">{proposal.note}</p> : null}
                    </div>
                    {pending ? (
                      <ProposalActions proposalId={proposal.id} canDecide={canDecide} canWithdraw={mine} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {canPropose ? (
            <div className="mt-5 border-t border-line pt-5">
              <ProposeAppointmentForm requestId={request.id} />
            </div>
          ) : null}
        </Card>

        <Card title="Izvedba" id="completion">
          {thread.completions.length === 0 ? (
            <p className="text-sm text-ink-muted">Izvedba še ni zabeležena.</p>
          ) : (
            <ul className="space-y-4">
              {thread.completions.map((c) => (
                <li key={c.id} className="rounded-md border border-line p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{formatDate(c.completed_on)}</span>
                    <Badge size="sm" tone={c.outcome === "not_completed" ? "warning" : "success"}>
                      {outcomeLabels[c.outcome]}
                    </Badge>
                    {c.voided_at ? (
                      <Badge size="sm" tone="outline">
                        Razveljavljeno
                      </Badge>
                    ) : (
                      <Badge
                        size="sm"
                        tone={
                          c.acknowledgment_status === "pending"
                            ? "warning"
                            : c.acknowledgment_status === "rejected"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {acknowledgmentLabels[c.acknowledgment_status]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-ink">{c.summary}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    Zabeležil(a): {name(c.recorded_by)} (
                    {c.recorded_as === "assignee" ? "zunanji serviser" : "organizacija"})
                    {c.replaces_id ? " · popravek razveljavljenega zapisa" : ""}
                  </p>
                  {c.acknowledgment_note ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      {c.acknowledgment_status === "rejected" ? "Razlog zavrnitve" : "Opomba ob potrditvi"}:{" "}
                      {c.acknowledgment_note}
                    </p>
                  ) : null}
                  {c.voided_at ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      Razveljavil(a) {name(c.voided_by)} {formatDateTime(c.voided_at)}: {c.void_reason}
                    </p>
                  ) : null}
                  {actor === "operator" && !c.voided_at && c.acknowledgment_status === "pending" ? (
                    <div className="mt-3">
                      <AcknowledgeForms completionId={c.id} />
                    </div>
                  ) : null}
                  {canVoid && !c.voided_at ? (
                    <div className="mt-3">
                      <VoidCompletionDialog completionId={c.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canRecord ? (
            <div className="mt-5 border-t border-line pt-5">
              <CompletionForm
                requestId={request.id}
                today={today}
                replaces={actor === "operator" ? voided : []}
                acknowledgmentNote={
                  actor === "assignee" && brief.require_completion_acknowledgment
                    ? "Izvedbo mora potrditi ustanova; servisni rok se posodobi po potrditvi."
                    : undefined
                }
              />
            </div>
          ) : null}
        </Card>

        <Card title="Sporočila" id="messages">
          {thread.messages.length === 0 ? (
            <p className="text-sm text-ink-muted">Ni sporočil.</p>
          ) : (
            <ol className="space-y-3">
              {thread.messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.visibility === "internal"
                      ? "rounded-md border border-dashed border-line-strong bg-subtle p-3"
                      : "rounded-md border border-line p-3"
                  }
                >
                  <p className="text-xs text-ink-muted">
                    {name(m.author_id)} · {formatDateTime(m.created_at)}
                    {m.visibility === "internal" ? " · interno, serviser ne vidi" : ""}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line text-ink">{m.body}</p>
                </li>
              ))}
            </ol>
          )}
          {canCoordinate ? (
            <div className="mt-5 border-t border-line pt-5">
              <MessageForm
                organizationId={request.organization_id}
                requestId={request.id}
                allowInternal={actor === "operator"}
              />
            </div>
          ) : null}
        </Card>
      </div>

      <aside className="space-y-6">
        <Card title="Oprema" id="equipment">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Naziv</dt>
              <dd className="text-ink">
                {equipmentHref ? (
                  <Link href={equipmentHref} className="font-medium underline-offset-2 hover:underline">
                    {brief.equipment_name}
                  </Link>
                ) : (
                  brief.equipment_name
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Kategorija</dt>
              <dd className="text-ink">{category}</dd>
            </div>
            {[
              ["Proizvajalec in model", [brief.manufacturer_name, brief.model].filter(Boolean).join(" ")],
              ["Serijska številka", brief.serial_number],
              ["Inventarna številka", brief.asset_tag],
              ["Lokacija", brief.location_name],
            ].map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="text-xs text-ink-muted">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </Card>

        <Card title="Zahtevek" id="details">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Organizacija</dt>
              <dd className="text-ink">{brief.organization_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Vrsta in nujnost</dt>
              <dd className="text-ink">
                {requestTypeLabels[request.request_type]} · {priorityLabels[request.priority]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Odprl(a)</dt>
              <dd className="text-ink">
                {name(request.created_by)}, {formatDateTime(request.created_at)}
              </dd>
            </div>
          </dl>
          {request.description ? (
            <p className="mt-3 text-sm whitespace-pre-line text-ink">{request.description}</p>
          ) : null}
        </Card>

        {actor !== "assignee" ? (
          <Card title="Zunanji sodelavci" id="assignees">
            {thread.assignments.length === 0 ? (
              <p className="text-sm text-ink-muted">Zahtevek nima dodeljenih zunanjih sodelavcev.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {thread.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="block text-ink">{name(a.assignee_user_id)}</span>
                      <span className="block text-xs text-ink-muted">
                        {a.revoked_at
                          ? `dostop odvzet ${formatDateTime(a.revoked_at)}`
                          : `dodeljen ${formatDateTime(a.created_at)}`}
                      </span>
                    </span>
                    {canAssign && !a.revoked_at ? (
                      <RevokeAssignmentButton
                        organizationId={request.organization_id}
                        assignmentId={a.id}
                        name={name(a.assignee_user_id)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canAssign && open ? (
              <div className="mt-4 border-t border-line pt-4">
                <InviteAssigneeForm organizationId={request.organization_id} requestId={request.id} />
                <p className="mt-2 text-xs text-ink-muted">
                  Serviser vidi samo ta zahtevek, podatke o opremi, termine, skupna sporočila in zapise o izvedbi.
                </p>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card title="Časovnica" id="timeline">
          {thread.events.length === 0 ? (
            <p className="text-sm text-ink-muted">Ni dogodkov.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {thread.events.map((event) => (
                <li key={event.id}>
                  <span className="block text-ink">
                    {describeEvent(event.event_type, event.from_status, event.to_status)}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {name(event.actor_user_id)} · {formatDateTime(event.created_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </aside>
    </div>
  );
}
