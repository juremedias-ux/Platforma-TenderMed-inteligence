import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/layout/brand";
import type { Membership, SessionUser } from "@/lib/auth/session";
import { orgRoleLabels, type OrgRole } from "@/lib/auth/permissions";

/** Application header: brand, organization switcher, extra slot and account menu. Native <details> menus work without JavaScript. */
export function TopBar({
  user,
  memberships,
  current,
  extra,
}: {
  user: SessionUser;
  memberships: Membership[];
  current?: { id: string; name: string; role: OrgRole };
  extra?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950 text-white">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/app" className="flex items-center gap-2 rounded-md" aria-label="TenderMed – izbira organizacije">
          <BrandMark inverse className="size-7" />
          <span className="hidden font-display text-[15px] font-semibold sm:inline">TenderMed</span>
        </Link>

        {current ? (
          <details className="relative min-w-0">
            <summary className="flex max-w-[52vw] cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-white/10 sm:max-w-xs">
              <span className="truncate font-medium">{current.name}</span>
              <span className="hidden text-navy-300 md:inline">· {orgRoleLabels[current.role]}</span>
              <ChevronDown className="size-4 shrink-0 text-navy-300" aria-hidden="true" />
              <span className="sr-only">Zamenjaj organizacijo</span>
            </summary>
            <div className="absolute left-0 mt-2 w-72 rounded-lg border border-line bg-surface p-1.5 text-ink shadow-overlay">
              <p className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted">Organizacije</p>
              <ul>
                {memberships.map((m) => (
                  <li key={m.organization.id}>
                    <Link
                      href={`/app/${m.organization.id}/pregled`}
                      aria-current={m.organization.id === current.id ? "true" : undefined}
                      className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-subtle aria-[current=true]:bg-accent-50"
                    >
                      <span className="truncate">{m.organization.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{orgRoleLabels[m.role]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/app/servisne-naloge"
                className="mt-1 block rounded-md px-2.5 py-2 text-sm text-ink-soft hover:bg-subtle"
              >
                Moje servisne naloge
              </Link>
            </div>
          </details>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {extra}
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-white/10">
              <UserRound className="size-4" aria-hidden="true" />
              <span className="sr-only">Račun</span>
              <ChevronDown className="size-4 text-navy-300" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-line bg-surface p-3 text-ink shadow-overlay">
              <p className="text-xs text-ink-muted">Prijavljeni kot</p>
              <p className="truncate text-sm font-medium">{user.email}</p>
              <form action={logoutAction} className="mt-3 border-t border-line pt-3">
                <button type="submit" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-subtle">
                  Odjava
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
