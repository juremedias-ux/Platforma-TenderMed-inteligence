import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/state-message";
import { orgRoleLabels } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Pregled" };

async function Overview({ params }: { params: PageProps<"/app/[organizationId]/pregled">["params"] }) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/pregled`);
  if (!context) return <NoAccess />;
  return (
    <PageHeader
      title="Pregled"
      description={`${context.organization.name} · vaša vloga: ${orgRoleLabels[context.role]}`}
    />
  );
}

export default function OverviewPage({ params }: PageProps<"/app/[organizationId]/pregled">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam pregled …</p>}>
      <Overview params={params} />
    </Suspense>
  );
}
