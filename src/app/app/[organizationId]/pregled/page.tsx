import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DueBadge } from "@/components/app/equipment/badges";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { buttonVariants } from "@/components/ui/button";
import { can, orgRoleLabels } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { addDays } from "@/lib/dates/date-only";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import { activityTypeLabels } from "@/lib/equipment/domain";
import { getOverviewCounts, listAgenda } from "@/lib/repositories/equipment";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Pregled" };

type Props = PageProps<"/app/[organizationId]/pregled">;

function Metric({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "danger" | "warning";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border bg-surface p-4 shadow-card transition-colors hover:border-navy-300",
        tone === "danger" && value > 0
          ? "border-danger-200"
          : tone === "warning" && value > 0
            ? "border-warning-200"
            : "border-line",
      )}
    >
      <span className="block text-sm text-ink-soft">{label}</span>
      <span
        className={cn(
          "mt-1 block font-display text-3xl font-semibold tabular-nums",
          tone === "danger" && value > 0
            ? "text-danger-700"
            : tone === "warning" && value > 0
              ? "text-warning-700"
              : "text-ink",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

async function Overview({ params }: Pick<Props, "params">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/pregled`);
  if (!context) return <NoAccess />;
  const { supabase, role, organization } = context;
  const today = ljubljanaDate();

  let loaded;
  try {
    const [counts, upcoming] = await Promise.all([
      getOverviewCounts(supabase, organizationId, today),
      listAgenda(supabase, organizationId, addDays(today, 30), 8),
    ]);
    loaded = { counts, upcoming };
  } catch {
    return <LoadError />;
  }
  const { counts, upcoming } = loaded;
  const base = `/app/${organizationId}`;

  return (
    <>
      <PageHeader title="Pregled" description={`${organization.name} · vaša vloga: ${orgRoleLabels[role]}`} />
      {counts.equipment === 0 ? (
        <StateMessage
          kind="empty"
          title="Register opreme je prazen"
          action={
            can(role, "equipment.manage") ? (
              <Link href={`${base}/oprema`} className={buttonVariants({ variant: "primary" })}>
                Dodaj ali uvozi opremo
              </Link>
            ) : undefined
          }
        >
          Pregled rokov in stanja opreme bo na voljo, ko bo v registru prva oprema.
        </StateMessage>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Oprema v evidenci" value={counts.equipment} href={`${base}/oprema`} />
            <Metric label="Rok je potekel" value={counts.overdue} href={`${base}/koledar?obdobje=30`} tone="danger" />
            <Metric label="Roki v 30 dneh" value={counts.dueSoon} href={`${base}/koledar?obdobje=30`} tone="warning" />
            <Metric
              label="Na servisu ali izven uporabe"
              value={counts.unavailable}
              href={`${base}/oprema?status=in_service`}
            />
            <Metric label="Brez odprtega roka" value={counts.withoutOpenDue} href={`${base}/oprema`} />
          </div>
          <section
            className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6"
            aria-labelledby="upcoming"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="upcoming" className="text-base font-semibold text-ink">
                Zamujeni in bližnji roki
              </h2>
              <Link href={`${base}/koledar`} className="text-sm font-medium text-accent-700 hover:underline">
                Koledar
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">V naslednjih 30 dneh ni rokov in noben rok ne zamuja.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <Link
                        href={`${base}/oprema/${item.equipment_id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {item.equipment_name}
                      </Link>
                      <span className="block text-sm text-ink-soft">
                        {item.activity_label ?? activityTypeLabels[item.activity_type]} ·{" "}
                        {formatDate(item.next_due_date)} ({describeDeadline(item.next_due_date, today)})
                      </span>
                    </span>
                    <DueBadge nextDue={item.next_due_date} today={today} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-muted">
              »Brez odprtega roka« pomeni opremo brez aktivnega servisnega načrta ali z opravljenim enkratnim načrtom.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

export default function OverviewPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam pregled …</p>}>
      <Overview params={params} />
    </Suspense>
  );
}
