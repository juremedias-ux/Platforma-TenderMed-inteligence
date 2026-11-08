import type { ReactNode } from "react";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/date-only";
import { cn } from "@/lib/utils/cn";

/** Small presentational helpers for the demo workspace. */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface shadow-card", className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KeyValueList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DateWithRelative({ date, reference }: { date: IsoDate | null; reference: IsoDate }) {
  if (!date) return <span className="text-ink-muted">Ni določen</span>;
  return (
    <span>
      <time dateTime={date}>{formatDate(date)}</time>
      <span className="block text-xs font-normal text-ink-muted">{describeDeadline(date, reference)}</span>
    </span>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm text-ink-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SerialNumber({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] tracking-tight text-ink-soft">{children}</span>;
}

export function DemoTag({ children = "demo" }: { children?: ReactNode }) {
  return (
    <span className="rounded-xs bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-warning-700 uppercase">
      {children}
    </span>
  );
}
