import { Info } from "lucide-react";
import { Section } from "@/components/ui/section";
import { institutions } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

export function InstitutionsSection() {
  return (
    <Section
      id="za-ustanove"
      eyebrow={institutions.eyebrow}
      title={institutions.title}
      intro={institutions.intro}
      tone="surface"
    >
      <ol className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
        {institutions.benefits.map((benefit, index) => {
          const Icon = getMarketingIcon(benefit.icon);
          return (
            <li key={benefit.title} className="border-t border-line pt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-lg border border-accent-200 bg-accent-50 text-accent-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-ink-muted">0{index + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-[-0.01em] text-ink">{benefit.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{benefit.text}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-12 flex max-w-3xl items-start gap-2.5 rounded-lg border border-line bg-subtle px-4 py-3.5 text-sm leading-relaxed text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
        {institutions.note}
      </p>
    </Section>
  );
}
