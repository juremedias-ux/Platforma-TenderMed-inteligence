import { Section } from "@/components/ui/section";
import { problem } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

export function ProblemSection() {
  return (
    <Section id="izziv" eyebrow="Izziv" title={problem.title} intro={problem.intro}>
      <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {problem.points.map((point) => {
          const Icon = getMarketingIcon(point.icon);
          return (
            <li key={point.title} className="bg-surface p-6 sm:p-7">
              <span className="inline-flex size-10 items-center justify-center rounded-md border border-line bg-subtle text-ink-soft">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-ink">{point.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{point.text}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
