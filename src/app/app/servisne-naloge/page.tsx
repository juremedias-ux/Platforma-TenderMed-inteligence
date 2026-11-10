import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge, RequestStatusBadge } from "@/components/app/service/badges";
import { LoadError, PlatformNotConfigured, StateMessage } from "@/components/app/state-message";
import { TopBar } from "@/components/app/top-bar";
import { getMemberships, getUserClient, isPlatformConfigured, requireUser } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/dates/datetime";
import { listNotifications } from "@/lib/repositories/notifications";
import { listMyAssignments } from "@/lib/repositories/service";
import { NotificationList } from "@/components/app/notifications/notification-list";
import { MarkAllReadButton } from "@/components/app/notifications/notification-forms";
import { requestTypeLabels } from "@/lib/service/domain";

export const metadata: Metadata = { title: "Servisne naloge" };

async function Assignments() {
  if (!(await isPlatformConfigured())) {
    return (
      <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
        <PlatformNotConfigured />
      </main>
    );
  }
  const user = await requireUser("/app/servisne-naloge");
  let loaded;
  try {
    const supabase = await getUserClient();
    loaded = {
      memberships: await getMemberships(),
      rows: await listMyAssignments(supabase),
      notifications: await listNotifications(supabase, { requestsOnly: true, unreadOnly: true }, 20),
    };
  } catch {
    loaded = null;
  }

  return (
    <>
      <TopBar user={user} memberships={loaded?.memberships ?? []} />
      <main id="vsebina" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8 focus:outline-none sm:px-6">
        <PageHeader
          title="Servisne naloge"
          description="Zahtevki, ki so vam jih dodelile organizacije. Vidite samo dodeljene zahtevke."
        />
        {loaded && loaded.notifications.length > 0 ? (
          <section
            className="mb-6 rounded-lg border border-line bg-surface p-5 shadow-card"
            aria-labelledby="new-notifications"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="new-notifications" className="text-base font-semibold text-ink">
                Nova obvestila
              </h2>
              <MarkAllReadButton />
            </div>
            <NotificationList notifications={loaded.notifications} />
          </section>
        ) : null}
        {!loaded ? (
          <LoadError />
        ) : loaded.rows.length === 0 ? (
          <StateMessage kind="empty" title="Nimate dodeljenih zahtevkov">
            Ko vas organizacija povabi k zahtevku, bo prikazan tukaj.
          </StateMessage>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-card">
            {loaded.rows.map((row) => (
              <li
                key={row.service_request_id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/app/servisne-naloge/${row.service_request_id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    #{row.reference_number} {row.title}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {row.organization_name} · {row.equipment_name}
                    {row.location_name ? ` · ${row.location_name}` : ""} · {requestTypeLabels[row.request_type]}
                  </p>
                  {row.scheduled_start && row.scheduled_end ? (
                    <p className="text-xs text-ink-muted">
                      Termin: {formatDateTimeRange(row.scheduled_start, row.scheduled_end)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <PriorityBadge priority={row.priority} />
                  <RequestStatusBadge status={row.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-ink-muted">Nalagam …</p>}>
      <Assignments />
    </Suspense>
  );
}
