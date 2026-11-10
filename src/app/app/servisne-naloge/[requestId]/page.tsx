import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge } from "@/components/app/service/badges";
import { RequestView } from "@/components/app/service/request-view";
import { LoadError, PlatformNotConfigured, StateMessage } from "@/components/app/state-message";
import { TopBar } from "@/components/app/top-bar";
import { getMemberships, getUserClient, isPlatformConfigured, requireUser } from "@/lib/auth/session";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { getRequest, getRequestBrief, getRequestThread, profileNames } from "@/lib/repositories/service";

export const metadata: Metadata = { title: "Servisna naloga" };

type Props = PageProps<"/app/servisne-naloge/[requestId]">;

async function Assignment({ params }: Pick<Props, "params">) {
  const { requestId } = await params;
  if (!(await isPlatformConfigured())) {
    return (
      <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
        <PlatformNotConfigured />
      </main>
    );
  }
  const user = await requireUser(`/app/servisne-naloge/${requestId}`);
  const memberships = await getMemberships().catch(() => []);

  let loaded;
  try {
    const supabase = await getUserClient();
    const request = await getRequest(supabase, requestId);
    if (request) {
      const [brief, thread] = await Promise.all([
        getRequestBrief(supabase, requestId),
        getRequestThread(supabase, requestId),
      ]);
      const names = await profileNames(supabase, [
        request.created_by,
        ...thread.proposals.flatMap((p) => [p.proposed_by, p.decided_by]),
        ...thread.messages.map((m) => m.author_id),
        ...thread.completions.flatMap((c) => [c.recorded_by, c.acknowledged_by, c.voided_by]),
        ...thread.events.map((e) => e.actor_user_id),
      ]);
      loaded = brief ? { request, brief, thread, names } : null;
    } else {
      loaded = null;
    }
  } catch {
    loaded = "error" as const;
  }

  // Members of the requesting organization use the organization view.
  if (loaded && loaded !== "error" && memberships.some((m) => m.organization.id === loaded.request.organization_id)) {
    redirect(`/app/${loaded.request.organization_id}/servisi/${requestId}`);
  }
  const active =
    loaded && loaded !== "error"
      ? loaded.thread.assignments.some((a) => a.assignee_user_id === user.id && !a.revoked_at)
      : false;

  return (
    <>
      <TopBar user={user} memberships={memberships} />
      <main id="vsebina" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 py-8 focus:outline-none sm:px-6">
        {loaded === "error" ? (
          <LoadError />
        ) : !loaded || !active ? (
          <StateMessage kind="forbidden" title="Do tega zahtevka nimate dostopa">
            Zahtevek ne obstaja ali vam ni (več) dodeljen.
          </StateMessage>
        ) : (
          <>
            <PageHeader
              breadcrumbs={[
                { href: "/app/servisne-naloge", label: "Servisne naloge" },
                { label: `#${loaded.request.reference_number}` },
              ]}
              title={`#${loaded.request.reference_number} ${loaded.request.title}`}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <span>{loaded.brief.organization_name}</span>
                  <PriorityBadge priority={loaded.request.priority} />
                </span>
              }
            />
            <RequestView
              request={loaded.request}
              brief={loaded.brief}
              thread={loaded.thread}
              names={loaded.names}
              actor="assignee"
              userId={user.id}
              today={ljubljanaDate()}
              canAssign={false}
              canVoid={false}
            />
          </>
        )}
      </main>
    </>
  );
}

export default function AssignmentPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-ink-muted">Nalagam …</p>}>
      <Assignment params={params} />
    </Suspense>
  );
}
