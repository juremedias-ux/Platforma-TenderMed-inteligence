import type { Metadata } from "next";
import { Suspense } from "react";
import { DueBadge, DueDate, EquipmentStatusBadge } from "@/components/app/equipment/badges";
import {
  ArchiveEquipmentButton,
  ArchivePlanButton,
  EditEquipmentDialog,
  PlanDialog,
} from "@/components/app/equipment/equipment-forms";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { describeAuditEvent } from "@/lib/audit/labels";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { formatDateTime, ljubljanaDate } from "@/lib/dates/datetime";
import { formatDate } from "@/lib/dates/format";
import {
  activityTypeLabels,
  equipmentCategoryLabels,
  scheduleModeLabels,
  sourceBasisLabels,
} from "@/lib/equipment/domain";
import { countMonths, explainSchedule } from "@/lib/maintenance/schedule";
import { listCompletionsForEquipment, listRequestsForEquipment } from "@/lib/repositories/service";
import { acknowledgmentLabels, outcomeLabels } from "@/lib/service/domain";
import { planLabel } from "@/lib/service/plan-label";
import Link from "next/link";
import { RequestStatusBadge } from "@/components/app/service/badges";
import { CreateRequestDialog } from "@/components/app/service/request-forms";
import { getEquipment, listAuditFor, listLocations, listMemberOptions, listPlans } from "@/lib/repositories/equipment";

export const metadata: Metadata = { title: "Oprema" };

type Props = PageProps<"/app/[organizationId]/oprema/[equipmentId]">;

function Card({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby={`h-${title}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`h-${title}`} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children ?? "—"}</dd>
    </div>
  );
}

async function EquipmentDetail({ params }: Pick<Props, "params">) {
  const { organizationId, equipmentId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/oprema/${equipmentId}`);
  if (!context) return <NoAccess />;
  const { supabase, role } = context;

  let loaded;
  try {
    const equipment = await getEquipment(supabase, organizationId, equipmentId);
    if (equipment) {
      const [plans, locations, members] = await Promise.all([
        listPlans(supabase, organizationId, equipmentId),
        listLocations(supabase, organizationId),
        listMemberOptions(supabase, organizationId),
      ]);
      const [audit, requests, completions] = await Promise.all([
        listAuditFor(supabase, organizationId, [equipment.id, ...plans.map((p) => p.id)]),
        listRequestsForEquipment(supabase, organizationId, equipment.id),
        listCompletionsForEquipment(supabase, organizationId, equipment.id),
      ]);
      loaded = { equipment, plans, locations, members, audit, requests, completions };
    } else {
      loaded = null;
    }
  } catch {
    return <LoadError />;
  }
  if (!loaded) {
    return (
      <StateMessage kind="empty" title="Oprema ne obstaja">
        Zapis ne obstaja ali ni del te organizacije.
      </StateMessage>
    );
  }
  const { equipment, plans, locations, members, audit, requests, completions } = loaded;
  const requestNumber = new Map(requests.map((r) => [r.id, r.reference_number]));
  const today = ljubljanaDate();
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const canManage = can(role, "equipment.manage");
  const canPlans = can(role, "plans.manage");
  const archived = equipment.status === "archived";
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));
  if (equipment.location_id && !locationOptions.some((l) => l.id === equipment.location_id)) {
    locationOptions.push({ id: equipment.location_id, name: `${equipment.location_name ?? "Lokacija"} (arhivirana)` });
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ href: `/app/${organizationId}/oprema`, label: "Oprema" }, { label: equipment.name }]}
        title={equipment.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <EquipmentStatusBadge status={equipment.status} />
            <span>{equipmentCategoryLabels[equipment.category]}</span>
            {equipment.asset_tag ? <span>· {equipment.asset_tag}</span> : null}
          </span>
        }
        actions={
          canManage ? (
            <>
              <EditEquipmentDialog
                organizationId={organizationId}
                equipment={equipment}
                locations={locationOptions}
                members={members}
              />
              <ArchiveEquipmentButton
                organizationId={organizationId}
                equipmentId={equipment.id}
                version={equipment.version}
                archived={archived}
              />
            </>
          ) : null
        }
      />

      <div className="space-y-6">
        <Card title="Podatki">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Proizvajalec">{equipment.manufacturer_name}</Field>
            <Field label="Model">{equipment.model}</Field>
            <Field label="Serijska številka">{equipment.serial_number}</Field>
            <Field label="Lokacija">{equipment.location_name}</Field>
            <Field label="Odgovorna oseba">
              {equipment.responsible_user_id
                ? (memberName.get(equipment.responsible_user_id) ?? "Nekdanji član")
                : null}
            </Field>
            <Field label="Naslednji rok">
              <DueDate nextDue={equipment.next_due_date} today={today} />
            </Field>
            <Field label="Datum nakupa">{equipment.purchase_date ? formatDate(equipment.purchase_date) : null}</Field>
            <Field label="Datum zagona">
              {equipment.commissioning_date ? formatDate(equipment.commissioning_date) : null}
            </Field>
            <Field label="Garancija do">
              {equipment.warranty_end_date ? formatDate(equipment.warranty_end_date) : null}
            </Field>
          </dl>
          {equipment.notes ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-ink-muted">Opombe</p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink">{equipment.notes}</p>
            </div>
          ) : null}
        </Card>

        <Card
          title="Servisni načrti"
          actions={
            canPlans && !archived ? (
              <PlanDialog organizationId={organizationId} equipmentId={equipment.id} members={members} />
            ) : null
          }
        >
          {plans.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Za to opremo še ni servisnih načrtov.
              {canPlans && !archived
                ? " Dodajte načrt z intervalom iz navodil proizvajalca, postopka ali pogodbe."
                : ""}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((plan) => {
                const planArchived = plan.status === "archived";
                const activity = plan.activity_label ?? activityTypeLabels[plan.activity_type];
                return (
                  <li
                    key={plan.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {activity}
                        <DueBadge nextDue={plan.next_due_date} today={today} archived={planArchived} />
                      </p>
                      <p className="text-sm text-ink-soft">
                        {scheduleModeLabels[plan.schedule_mode]}
                        {plan.interval_months ? ` · ${countMonths(plan.interval_months)}` : ""} · naslednji rok:{" "}
                        {plan.next_due_date ? formatDate(plan.next_due_date) : "ni odprt"}
                        {plan.last_completed_on ? ` · zadnja izvedba: ${formatDate(plan.last_completed_on)}` : ""}
                      </p>
                      <p className="text-[13px] text-ink-muted">
                        {explainSchedule({
                          mode: plan.schedule_mode,
                          intervalMonths: plan.interval_months,
                          anchorDate: plan.anchor_date,
                          dueDate: plan.due_date,
                          lastCompletedOn: plan.last_completed_on,
                        })}
                      </p>
                      <p className="text-[13px] text-ink-muted">
                        Podlaga: {sourceBasisLabels[plan.source_basis]}
                        {plan.source_note ? ` (${plan.source_note})` : ""}
                        {plan.responsible_user_id
                          ? ` · odgovorna oseba: ${memberName.get(plan.responsible_user_id) ?? "nekdanji član"}`
                          : ""}
                        {plan.reminder_days.length > 0
                          ? ` · opomniki: ${plan.reminder_days.join(", ")} dni pred rokom`
                          : " · brez opomnikov"}
                      </p>
                    </div>
                    {canPlans ? (
                      <div className="flex shrink-0 gap-2">
                        {!planArchived ? (
                          <PlanDialog
                            organizationId={organizationId}
                            equipmentId={equipment.id}
                            plan={plan}
                            members={members}
                          />
                        ) : null}
                        <ArchivePlanButton
                          organizationId={organizationId}
                          planId={plan.id}
                          version={plan.version}
                          archived={planArchived}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Servisni zahtevki"
          actions={
            can(role, "service.create") && !archived ? (
              <CreateRequestDialog
                organizationId={organizationId}
                equipment={[
                  {
                    id: equipment.id,
                    name: equipment.name,
                    plans: plans.filter((p) => p.status === "active").map((p) => ({ id: p.id, label: planLabel(p) })),
                  },
                ]}
                defaultEquipmentId={equipment.id}
                label="Nov zahtevek"
              />
            ) : null
          }
        >
          {requests.length === 0 ? (
            <p className="text-sm text-ink-muted">Za to opremo ni servisnih zahtevkov.</p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <Link
                    href={`/app/${organizationId}/servisi/${r.id}`}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    #{r.reference_number} {r.title}
                  </Link>
                  <RequestStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Servisna zgodovina">
          {completions.length === 0 ? (
            <p className="text-sm text-ink-muted">Ni zapisov o izvedenih servisih.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {completions.map((c) => (
                <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-medium text-ink">
                    {formatDate(c.completed_on)} · {outcomeLabels[c.outcome]}
                    <span className="font-normal text-ink-muted">
                      {" "}
                      · {c.voided_at ? "razveljavljeno" : acknowledgmentLabels[c.acknowledgment_status]}
                    </span>
                  </p>
                  <p className={c.voided_at ? "text-ink-muted line-through" : "text-ink-soft"}>{c.summary}</p>
                  <Link
                    href={`/app/${organizationId}/servisi/${c.service_request_id}`}
                    className="text-xs text-accent-700 hover:underline"
                  >
                    Zahtevek #{requestNumber.get(c.service_request_id) ?? ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Zgodovina sprememb">
          {audit.length === 0 ? (
            <p className="text-sm text-ink-muted">Ni zabeleženih sprememb.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {audit.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <time dateTime={event.created_at} className="shrink-0 text-ink-muted tabular-nums sm:w-36">
                    {formatDateTime(event.created_at)}
                  </time>
                  <span className="text-ink">
                    {describeAuditEvent(event.entity_type, event.action, event.changed_columns)}
                    <span className="text-ink-muted">
                      {" "}
                      · {event.actor_user_id ? (memberName.get(event.actor_user_id) ?? "nekdanji član") : "sistem"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Zgodovina beleži, kaj je bilo spremenjeno in kdo, ne pa vsebine.
          </p>
        </Card>
      </div>
    </>
  );
}

export default function EquipmentDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam opremo …</p>}>
      <EquipmentDetail params={params} />
    </Suspense>
  );
}
