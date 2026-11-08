import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { Section } from "@/components/ui/section";
import { modules, plannedCapabilities } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

export function ModulesSection() {
  return (
    <Section
      id="funkcionalnosti"
      eyebrow={modules.eyebrow}
      title={modules.title}
      intro={modules.intro}
      tone="surface"
      headerAside={
        <ul aria-label="Pomen oznak" className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          {(["interactive_demo", "in_development", "planned"] as const).map((availability) => (
            <li key={availability}>
              <AvailabilityBadge availability={availability} />
            </li>
          ))}
        </ul>
      }
    >
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.items.map((module) => {
          const Icon = getMarketingIcon(module.icon);
          return (
            <li
              key={module.id}
              className="flex flex-col rounded-xl border border-line bg-canvas p-6 transition-colors duration-200 hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-navy-900 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <AvailabilityBadge availability={module.availability} />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-[-0.01em] text-ink">{module.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{module.description}</p>
              {module.futureNote ? (
                <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{module.futureNote}</p>
              ) : null}
              {module.demoLink ? (
                <Link
                  href={module.demoLink.href}
                  className="group mt-5 inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-semibold text-accent-700 hover:text-accent-800"
                >
                  {module.demoLink.label}
                  <ArrowRight
                    className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-canvas/60 p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Še ni del demonstracije</h3>
        <p className="mt-1 text-sm text-ink-muted">Predvidene funkcionalnosti za poznejše faze razvoja.</p>
        <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {plannedCapabilities.map((item) => (
            <li
              key={item.label}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-sm text-ink-soft"
            >
              <span>{item.label}</span>
              <AvailabilityBadge availability={item.availability} />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
