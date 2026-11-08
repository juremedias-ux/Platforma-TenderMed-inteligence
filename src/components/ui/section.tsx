import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Container } from "./container";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "canvas" | "surface" | "navy";
  align?: "left" | "center";
  headerAside?: ReactNode;
}

/** Marketing section with a consistent heading block and vertical rhythm. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
  tone = "canvas",
  align = "left",
  headerAside,
}: SectionProps) {
  const headingId = id ? `${id}-naslov` : undefined;
  const dark = tone === "navy";
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "py-20 sm:py-24 lg:py-28",
        tone === "surface" && "border-y border-line bg-surface",
        dark && "bg-navy-900 text-white",
        className,
      )}
    >
      <Container>
        <div
          className={cn(
            "flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",
            align === "center" && "items-center text-center lg:flex-col lg:items-center",
          )}
        >
          <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
            {eyebrow ? (
              <p
                className={cn(
                  "mb-4 text-xs font-semibold uppercase tracking-[0.14em]",
                  dark ? "text-accent-200" : "text-accent-700",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={headingId}
              className={cn(
                "font-display text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]",
                dark ? "text-white" : "text-ink",
              )}
            >
              {title}
            </h2>
            {intro ? (
              <div
                className={cn(
                  "mt-5 text-base leading-relaxed text-pretty sm:text-lg",
                  dark ? "text-navy-200" : "text-ink-soft",
                )}
              >
                {intro}
              </div>
            ) : null}
          </div>
          {headerAside}
        </div>
        <div className="mt-12 sm:mt-14">{children}</div>
      </Container>
    </section>
  );
}
