import { BookOpenCheck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { howItWorks } from "@/data/marketing/home";

export function HowItWorksSection() {
  return (
    <Section id="kako-deluje" eyebrow={howItWorks.eyebrow} title={howItWorks.title}>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {howItWorks.steps.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col rounded-xl border border-line bg-surface p-6 shadow-card transition-shadow duration-200 hover:shadow-raised"
          >
            <span className="font-display text-sm font-semibold text-accent-700">Korak {index + 1}</span>
            <h3 className="mt-3 text-lg leading-snug font-semibold text-ink">{step.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 flex max-w-3xl items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
        <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
        {howItWorks.note}
      </p>
    </Section>
  );
}
