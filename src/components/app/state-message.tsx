import { CircleAlert, FolderOpen, LockKeyhole, PlugZap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Distinct states for "no data", "no permission", "integration not configured"
 * and "operational error". They are deliberately not interchangeable.
 */
export type StateKind = "empty" | "forbidden" | "not-configured" | "error";

const icons = { empty: FolderOpen, forbidden: LockKeyhole, "not-configured": PlugZap, error: CircleAlert };

const tones: Record<StateKind, string> = {
  empty: "border-line bg-surface text-ink-soft",
  forbidden: "border-warning-200 bg-warning-50 text-warning-700",
  "not-configured": "border-info-200 bg-info-50 text-info-700",
  error: "border-danger-200 bg-danger-50 text-danger-700",
};

export function StateMessage({
  kind,
  title,
  children,
  action,
  className,
}: {
  kind: StateKind;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icons[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn("flex flex-col items-start gap-3 rounded-lg border px-5 py-6 sm:flex-row", tones[kind], className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="mt-1 text-sm leading-relaxed">{children}</div> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function NoAccess() {
  return (
    <StateMessage kind="forbidden" title="Do te vsebine nimate dostopa">
      Organizacija ne obstaja ali v njej nimate članstva. Če menite, da bi morali imeti dostop, se obrnite na skrbnika
      organizacije.
    </StateMessage>
  );
}

export function PlatformNotConfigured() {
  return (
    <StateMessage kind="not-configured" title="Platforma ni konfigurirana">
      Povezava s podatkovno bazo ni nastavljena. Javna spletna stran deluje, aplikacija pa bo na voljo po konfiguraciji
      (glej docs/pilot-runbook.md).
    </StateMessage>
  );
}

export function LoadError() {
  return (
    <StateMessage kind="error" title="Podatkov ni bilo mogoče naložiti">
      Prišlo je do napake pri povezavi s podatkovno bazo. Osvežite stran ali poskusite kasneje.
    </StateMessage>
  );
}
