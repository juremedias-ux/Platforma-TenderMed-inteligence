import { Suspense } from "react";
import { AppNav } from "@/components/app/app-nav";
import { appNavKeys } from "@/components/app/nav-config";
import { NoAccess, PlatformNotConfigured } from "@/components/app/state-message";
import { TopBar } from "@/components/app/top-bar";
import { getMemberships, getOrgContext, isPlatformConfigured, requireUser } from "@/lib/auth/session";

async function OrgShell({
  params,
  children,
}: {
  params: LayoutProps<"/app/[organizationId]">["params"];
  children: React.ReactNode;
}) {
  const { organizationId } = await params;
  if (!(await isPlatformConfigured())) {
    return (
      <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
        <PlatformNotConfigured />
      </main>
    );
  }
  const user = await requireUser(`/app/${organizationId}/pregled`);
  const [context, memberships] = await Promise.all([getOrgContext(organizationId), getMemberships()]);

  if (!context) {
    return (
      <>
        <TopBar user={user} memberships={memberships} />
        <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
          <NoAccess />
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar
        user={user}
        memberships={memberships}
        current={{ id: context.organization.id, name: context.organization.name, role: context.role }}
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-line bg-surface lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
          <AppNav organizationId={context.organization.id} keys={appNavKeys} />
        </aside>
        <main
          id="vsebina"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </>
  );
}

export default function OrganizationLayout({ children, params }: LayoutProps<"/app/[organizationId]">) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-ink-muted">Nalagam …</p>}>
      <OrgShell params={params}>{children}</OrgShell>
    </Suspense>
  );
}
