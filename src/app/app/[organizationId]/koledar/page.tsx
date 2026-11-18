import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DueBadge } from "@/components/app/equipment/badges";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { cn } from "@/lib/utils/cn";
import { requireOrgPage } from "@/lib/auth/session";
import { addDays } from "@/lib/dates/date-only";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import { activityTypeLabels } from "@/lib/equipment/domain";
import { listAgenda, type AgendaRow } from "@/lib/repositories/equipment";

export const metadata: Metadata = { title: "Koledar" };

type Props = PageProps<"/app/[organizationId]/koledar">;

const ranges = [
  { days: 30, label: "30 dni" },
  { days: 90, label: "90 dni" },
  { days: 365, label: "12 mesecev" },
] as const;

const monthFormatter = new Intl.DateTimeFormat("sl-SI", { month: "long", year: "numeric", timeZone: "UTC" });

function groupByMonth(rows: AgendaRow[], today: string) {
  const groups = new Map<string, AgendaRow[]>();
  for (const row of rows) {
    const key = row.next_due_date < today ? "overdue" : row.next_due_date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    title: key === "overdue" ? "Rok je potekel" : monthFormatter.format(new Date(`${key}-01T00:00:00Z`)),
    items,
  }));
}

async function Agenda({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/koledar`);
  if (!context) return <NoAccess />;
  const query = await searchParams;
  const requested = Number(Array.isArray(query.obdobje) ? query.obdobje[0] : query.obdobje);
  const days = ranges.find((r) => r.days === requested)?.days ?? 90;
  const today = ljubljanaDate();

  let rows: AgendaRow[];
  try {
    rows = await listAgenda(context.supabase, organizationId, addDays(today, days));
  } catch {
    return <LoadError />;
  }
  const groups = groupByMonth(rows, today);

  return (
    <>
      <PageHeader
        title="Koledar"
        description="Odprti roki aktivnih servisnih načrtov. Zamujeni roki so prikazani na vrhu."
        actions={
          <nav aria-label="Obdobje" className="flex gap-1 rounded-md border border-line bg-surface p-1">
            {ranges.map((range) => (
              <Link
                key={range.days}
                href={`/app/${organizationId}/koledar?obdobje=${range.days}`}
                aria-current={range.days === days ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium",
                  range.days === days ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-subtle",
                )}
              >
                {range.label}
              </Link>
            ))}
          </nav>
        }
      />
      {groups.length === 0 ? (
        <StateMessage kind="empty" title="V izbranem obdobju ni rokov">
          Roki se prikažejo, ko opremi dodate servisne načrte.
        </StateMessage>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`month-${group.key}`}>
              <h2
                id={`month-${group.key}`}
                className={cn(
                  "mb-2 text-sm font-semibold first-letter:uppercase",
                  group.key === "overdue" ? "text-danger-700" : "text-ink",
                )}
              >
                {group.title} <span className="font-normal text-ink-muted">({group.items.length})</span>
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-card">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 gap-4">
                      <time
                        dateTime={item.next_due_date}
                        className="w-24 shrink-0 text-sm font-medium text-ink tabular-nums"
                      >
                        {formatDate(item.next_due_date)}
                        <span className="block text-xs font-normal text-ink-muted">
                          {describeDeadline(item.next_due_date, today)}
                        </span>
                      </time>
                      <div className="min-w-0">
                        <Link
                          href={`/app/${organizationId}/oprema/${item.equipment_id}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {item.equipment_name}
                        </Link>
                        <p className="text-sm text-ink-soft">
                          {item.activity_label ?? activityTypeLabels[item.activity_type]}
                          {item.asset_tag ? ` · ${item.asset_tag}` : ""}
                          {item.location_name ? ` · ${item.location_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <DueBadge nextDue={item.next_due_date} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default function CalendarPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam koledar …</p>}>
      <Agenda params={params} searchParams={searchParams} />
    </Suspense>
  );
}
