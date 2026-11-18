import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge } from "@/components/app/service/badges";
import { EditRequestDialog } from "@/components/app/service/request-forms";
import { RequestView } from "@/components/app/service/request-view";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { ljubljanaDate } from "@/lib/dates/datetime";
import { getRequest, getRequestBrief, getRequestThread, listDocuments, profileNames } from "@/lib/repositories/service";

export const metadata: Metadata = { title: "Servisni zahtevek" };

type Props = PageProps<"/app/[organizationId]/servisi/[requestId]">;

async function RequestDetail({ params }: Pick<Props, "params">) {
  const { organizationId, requestId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/servisi/${requestId}`);
  if (!context) return <NoAccess />;
  const { supabase, role, user } = context;

  let loaded;
  try {
    const request = await getRequest(supabase, requestId);
    if (request && request.organization_id === organizationId) {
      const [brief, thread, documents] = await Promise.all([
        getRequestBrief(supabase, requestId),
        getRequestThread(supabase, requestId),
        listDocuments(supabase, { organizationId: request.organization_id, requestId }),
      ]);
      const names = await profileNames(supabase, [
        request.created_by,
        ...thread.proposals.flatMap((p) => [p.proposed_by, p.decided_by]),
        ...thread.messages.map((m) => m.author_id),
        ...thread.completions.flatMap((c) => [c.recorded_by, c.acknowledged_by, c.voided_by]),
        ...thread.events.map((e) => e.actor_user_id),
        ...documents.map((d) => d.created_by),
        ...thread.assignments.map((a) => a.assignee_user_id),
      ]);
      loaded = brief ? { request, brief, thread, names, documents } : null;
    } else {
      loaded = null;
    }
  } catch {
    return <LoadError />;
  }
  if (!loaded) {
    return (
      <StateMessage kind="empty" title="Zahtevek ne obstaja">
        Zahtevek ne obstaja ali ni del te organizacije.
      </StateMessage>
    );
  }
  const { request, brief, thread, names, documents } = loaded;
  const operator = can(role, "service.coordinate");
  const open = request.status !== "zakljuceno" && request.status !== "preklicano";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { href: `/app/${organizationId}/servisi`, label: "Servisi" },
          { label: `#${request.reference_number}` },
        ]}
        title={`#${request.reference_number} ${request.title}`}
        description={<PriorityBadge priority={request.priority} />}
        actions={operator && open ? <EditRequestDialog organizationId={organizationId} request={request} /> : null}
      />
      <RequestView
        request={request}
        brief={brief}
        thread={thread}
        names={names}
        actor={operator ? "operator" : "viewer"}
        userId={user.id}
        today={ljubljanaDate()}
        equipmentHref={`/app/${organizationId}/oprema/${request.equipment_id}`}
        canAssign={can(role, "service.assign")}
        canVoid={can(role, "completion.void")}
        documents={documents}
      />
    </>
  );
}

export default function RequestDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam zahtevek …</p>}>
      <RequestDetail params={params} />
    </Suspense>
  );
}
