import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadError, PlatformNotConfigured, StateMessage } from "@/components/app/state-message";
import { TopBar } from "@/components/app/top-bar";
import { getMemberships, isPlatformConfigured, requireUser } from "@/lib/auth/session";
import { orgRoleLabels } from "@/lib/auth/permissions";
import { countActiveAssignments } from "@/lib/repositories/assignments";

export const metadata: Metadata = { title: "Izbira organizacije" };

const kindLabels: Record<string, string> = {
  healthcare_provider: "Zdravstvena ustanova",
  distributor: "Distributer",
  service_provider: "Serviser",
  manufacturer: "Proizvajalec",
};

async function Hub() {
  if (!(await isPlatformConfigured())) {
    return (
      <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
        <PlatformNotConfigured />
      </main>
    );
  }
  const user = await requireUser("/app");
  let loaded;
  try {
    loaded = { memberships: await getMemberships(), assignments: await countActiveAssignments() };
  } catch {
    loaded = null;
  }
  if (!loaded) {
    return (
      <main id="vsebina" className="mx-auto max-w-3xl px-4 py-10">
        <LoadError />
      </main>
    );
  }
  const { memberships, assignments } = loaded;

  if (memberships.length === 1 && assignments === 0) {
    redirect(`/app/${memberships[0]!.organization.id}/pregled`);
  }

  return (
    <>
      <TopBar user={user} memberships={memberships} />
      <main id="vsebina" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 focus:outline-none sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Izberite organizacijo</h1>
        {memberships.length === 0 && assignments === 0 ? (
          <StateMessage kind="empty" title="Še nimate dostopa do nobene organizacije" className="mt-6">
            Dostop dobite s povabilom skrbnika organizacije. Povezavo povabila odprite v tem brskalniku.
          </StateMessage>
        ) : null}
        <ul className="mt-6 space-y-3">
          {memberships.map((m) => (
            <li key={m.organization.id}>
              <Link
                href={`/app/${m.organization.id}/pregled`}
                className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 shadow-card hover:border-line-strong"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{m.organization.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {kindLabels[m.organization.kind] ?? m.organization.kind} · {orgRoleLabels[m.role]}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
          {assignments > 0 ? (
            <li>
              <Link
                href="/app/servisne-naloge"
                className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 shadow-card hover:border-line-strong"
              >
                <span>
                  <span className="block font-medium text-ink">Moje servisne naloge</span>
                  <span className="block text-sm text-ink-muted">
                    Zahtevki, ki so vam jih dodelile druge organizacije: {assignments}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      </main>
    </>
  );
}

export default function ApplicationHome() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-ink-muted">Nalagam …</p>}>
      <Hub />
    </Suspense>
  );
}
