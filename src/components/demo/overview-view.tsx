"use client";

import { ArrowRight, Info } from "lucide-react";
import { activityTypeLabels, scheduleBasisLabels } from "@/features/equipment/labels";
import { computeOverview, getAttentionActivities, sortRequestsForDisplay } from "@/features/demo/selectors";
import { issueCategoryLabels } from "@/features/service/labels";
import { cn } from "@/lib/utils/cn";
import { useDemo } from "./demo-context";
import { DateWithRelative, EmptyState, Panel } from "./demo-shared";
import { MaintenanceStatusBadge, ServiceRequestStatusBadge } from "./status-badges";

export function OverviewView() {
  const { snapshot, state, navigate, openEquipment } = useDemo();
  const { dataset } = snapshot;
  const overview = computeOverview(dataset, state);
  const activities = getAttentionActivities(dataset, state.plans, state.referenceDate);
  const openRequests = sortRequestsForDisplay(state.serviceRequests).filter((r) => r.status !== "closed");

  const tiles = [
    {
      label: "Naprave v evidenci",
      value: overview.deviceCount,
      action: () => navigate("oprema"),
      actionLabel: "Odpri evidenco opreme",
    },
    {
      label: "Zamujene aktivnosti",
      value: overview.overdueActivities,
      tone: overview.overdueActivities > 0 ? "danger" : undefined,
      action: () => navigate("oprema", { filters: { status: "overdue" } }),
      actionLabel: "Prikaži naprave z zamudo",
    },
    {
      label: "Aktivnosti v naslednjih 30 dneh",
      value: overview.upcomingActivities,
      tone: overview.upcomingActivities > 0 ? "warning" : undefined,
      action: () => navigate("oprema", { filters: { status: "due_soon" } }),
      actionLabel: "Prikaži naprave s prihajajočimi roki",
    },
    {
      label: "Odprti servisni zahtevki",
      value: overview.openServiceRequests,
      action: () => navigate("servisi"),
      actionLabel: "Odpri servisne zahtevke",
    },
    {
      label: "Priporočila za pregled",
      value: overview.recommendationsAwaitingReview,
      action: () => navigate("priporocila"),
      actionLabel: "Odpri priporočila",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <button
              type="button"
              onClick={tile.action}
              className="group flex h-full w-full flex-col justify-between gap-3 rounded-lg border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-line-strong"
            >
              <span className="text-[13px] leading-snug text-ink-muted">{tile.label}</span>
              <span className="flex items-end justify-between gap-2">
                <span
                  data-overview-value
                  className={cn(
                    "font-display text-3xl font-semibold tabular-nums",
                    "tone" in tile && tile.tone === "danger" && "text-danger-700",
                    "tone" in tile && tile.tone === "warning" && "text-warning-700",
                    !("tone" in tile && tile.tone) && "text-ink",
                  )}
                >
                  {tile.value}
                </span>
                <ArrowRight
                  className="mb-1.5 size-4 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
              <span className="sr-only">{tile.actionLabel}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Aktivnosti, ki zahtevajo pozornost"
          description="Zamujene aktivnosti in roki v naslednjih 30 dneh."
          bodyClassName="p-0 sm:p-0"
        >
          {activities.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Ni zamujenih ali prihajajočih aktivnosti." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {activities.map((activity) => (
                <li key={activity.plan.id}>
                  <button
                    type="button"
                    onClick={() => openEquipment(activity.equipment.id)}
                    className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        {activity.equipment.name} {activity.equipment.model}
                      </span>
                      <span className="block text-[13px] text-ink-muted">
                        {activityTypeLabels[activity.plan.activityType]} · {activity.locationName}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        Vir roka: {scheduleBasisLabels[activity.plan.source.basis]}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                      <MaintenanceStatusBadge status={activity.status} size="sm" />
                      <span className="text-right text-[13px] text-ink-soft">
                        <DateWithRelative date={activity.dueDate} reference={state.referenceDate} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Odprti servisni zahtevki" bodyClassName="p-0 sm:p-0">
            {openRequests.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Ni odprtih servisnih zahtevkov." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {openRequests.map((request) => {
                  const equipment = dataset.equipment.find((e) => e.id === request.equipmentId);
                  return (
                    <li key={request.id}>
                      <button
                        type="button"
                        onClick={() => navigate("servisi", { requestId: request.id })}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle sm:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {equipment?.name} {equipment?.model}
                          </span>
                          <span className="block truncate text-[13px] text-ink-muted">
                            {issueCategoryLabels[request.issueCategory]}
                          </span>
                        </span>
                        <ServiceRequestStatusBadge status={request.status} size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="flex items-start gap-3 rounded-lg border border-line bg-subtle p-4 text-[13px] leading-relaxed text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
            <p>
              Roki in intervali so demonstracijski vhodni podatki, označeni z virom (navodila proizvajalca, interni
              postopek ali servisna pogodba). Platforma jih ne ocenjuje in ne priporoča intervalov za resnično opremo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
