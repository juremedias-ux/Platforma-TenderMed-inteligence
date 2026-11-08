import { Boxes, Gavel, LayoutDashboard, Lightbulb, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MaintenanceStatusBadge, ReviewLabelBadge, ServiceRequestStatusBadge } from "@/components/demo/status-badges";
import { activityTypeLabels } from "@/features/equipment/labels";
import { commercialDisclosure } from "@/features/recommendations/labels";
import { computeOverview, getAttentionActivities } from "@/features/demo/selectors";
import { createInitialDemoState } from "@/features/demo/state";
import type { DemoSnapshot } from "@/features/demo/snapshot";
import { issueCategoryLabels } from "@/features/service/labels";
import { describeDeadline } from "@/lib/dates/format";

/**
 * Hero visual: a static HTML rendering of the demo workspace. Every number
 * and status is computed from the demo dataset with the same selectors the
 * interactive demo uses. It contains no interactive controls.
 */
export function ProductPreview({ snapshot }: { snapshot: DemoSnapshot }) {
  const { dataset, recommendations } = snapshot;
  const state = createInitialDemoState(dataset, recommendations);
  const overview = computeOverview(dataset, state);
  const activities = getAttentionActivities(dataset, state.plans, state.referenceDate).slice(0, 4);
  const request = state.serviceRequests.find((r) => r.status === "coordinating") ?? state.serviceRequests[0]!;
  const requestEquipment = dataset.equipment.find((e) => e.id === request.equipmentId)!;
  const recommendation = recommendations.find((r) => r.reviewLabel === "worth_review") ?? recommendations[0]!;
  const product = dataset.products.find((p) => p.id === recommendation.productId)!;

  const stats = [
    { label: "Naprave", value: overview.deviceCount },
    { label: "Zamujene aktivnosti", value: overview.overdueActivities, emphasis: true },
    { label: "V naslednjih 30 dneh", value: overview.upcomingActivities },
    { label: "Odprti zahtevki", value: overview.openServiceRequests },
  ];

  const nav = [
    { label: "Pregled", icon: LayoutDashboard, active: true },
    { label: "Oprema", icon: Boxes },
    { label: "Servisi", icon: Wrench },
    { label: "Priporočila", icon: Lightbulb },
    { label: "Razpisi", icon: Gavel },
  ];

  return (
    <figure className="relative" aria-label="Predogled demo vmesnika z izmišljenimi podatki">
      <div className="overflow-hidden rounded-xl border border-line-strong/70 bg-surface shadow-raised">
        {/* Window chrome */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </span>
            <span className="ml-2 text-xs font-medium text-ink-soft">TenderMed · {dataset.organization.name}</span>
          </div>
          <Badge tone="warning" size="sm">
            Demo · izmišljeni podatki
          </Badge>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden shrink-0 flex-col gap-0.5 bg-navy-900 p-2 sm:flex" aria-hidden="true">
            {nav.map((item) => (
              <span
                key={item.label}
                className={
                  item.active
                    ? "flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-2 text-xs font-medium text-white"
                    : "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-navy-300"
                }
              >
                <item.icon className="size-3.5" />
                <span className="hidden md:inline lg:hidden">{item.label}</span>
              </span>
            ))}
          </div>

          {/* Main */}
          <div className="min-w-0 flex-1 space-y-3 bg-canvas p-3 sm:p-4">
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-md border border-line bg-surface px-3 py-2.5">
                  <dt className="text-[11px] leading-tight text-ink-muted">{stat.label}</dt>
                  <dd
                    className={
                      stat.emphasis
                        ? "mt-1 font-display text-xl font-semibold text-danger-700"
                        : "mt-1 font-display text-xl font-semibold text-ink"
                    }
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr] lg:grid-cols-1">
              <div className="rounded-md border border-line bg-surface">
                <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">Prihajajoči servisi</p>
                <ul className="divide-y divide-line">
                  {activities.map((activity) => (
                    <li key={activity.plan.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink">
                          {activity.equipment.name} {activity.equipment.model}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {activityTypeLabels[activity.plan.activityType]} ·{" "}
                          {activity.dueDate
                            ? describeDeadline(activity.dueDate, state.referenceDate)
                            : "rok ni določen"}
                        </p>
                      </div>
                      <MaintenanceStatusBadge status={activity.status} size="sm" />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">Servisni zahtevek</p>
                    <ServiceRequestStatusBadge status={request.status} size="sm" />
                  </div>
                  <p className="mt-2 text-xs font-medium text-ink">
                    {requestEquipment.name} {requestEquipment.model}
                  </p>
                  <p className="text-[11px] text-ink-muted">{issueCategoryLabels[request.issueCategory]}</p>
                  {request.proposedAppointment ? (
                    <p className="mt-2 text-[11px] text-ink-soft">
                      Predlagan termin: {describeDeadline(request.proposedAppointment, state.referenceDate)} · čaka na
                      potrditev
                    </p>
                  ) : null}
                </div>

                <div className="rounded-md border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">Priporočilo</p>
                    <ReviewLabelBadge label={recommendation.reviewLabel} size="sm" />
                  </div>
                  <p className="mt-2 text-xs font-medium text-ink">
                    {product.name} {product.model}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium text-ink-soft">Zakaj je predlog relevanten</p>
                  <p className="text-[11px] leading-snug text-ink-muted">{recommendation.relevance.reasons[0]}</p>
                  <p className="mt-1.5 text-[11px] text-ink-muted">
                    {commercialDisclosure[recommendation.commercialRelationship].label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-ink-muted">
        Predogled demo vmesnika. Vsi podatki so izmišljeni in izračunani iz demonstracijskega nabora.
      </figcaption>
    </figure>
  );
}
