import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-line bg-surface p-6 shadow-raised sm:p-8"
      aria-labelledby="auth-naslov"
    >
      <h1 id="auth-naslov" className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {description ? <div className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</div> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
