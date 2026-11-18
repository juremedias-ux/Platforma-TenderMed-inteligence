import { Info } from "lucide-react";
import type { CSSProperties } from "react";
import { Container } from "@/components/ui/container";
import { institutions } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

const shift = (index: number) => ({ "--reveal-shift": `${index * 4}%` }) as CSSProperties;

export function InstitutionsSection() {
  return (
    <section
      id="za-ustanove"
      aria-labelledby="za-ustanove-naslov"
      className="relative overflow-x-clip border-t border-white/10 bg-navy-950 py-24 text-white sm:py-32"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="motion-reveal text-xs font-semibold tracking-[0.18em] text-accent-200 uppercase">
            {institutions.eyebrow}
          </p>
          <h2
            id="za-ustanove-naslov"
            className="motion-reveal mt-4 font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl"
            style={shift(1)}
          >
            {institutions.title}
          </h2>
          <p className="motion-reveal mt-6 text-lg leading-relaxed text-pretty text-navy-200" style={shift(2)}>
            {institutions.intro}
          </p>
        </div>
        <ol className="mt-16 grid gap-x-10 gap-y-14 md:grid-cols-2 xl:grid-cols-4">
          {institutions.benefits.map((benefit, index) => {
            const Icon = getMarketingIcon(benefit.icon);
            return (
              <li key={benefit.title} className="motion-reveal border-t border-white/15 pt-6" style={shift(index)}>
                <span
                  aria-hidden="true"
                  className="motion-zoom text-gradient block origin-left font-display text-7xl leading-none font-semibold tracking-[-0.04em]"
                >
                  0{index + 1}
                </span>
                <h3 className="mt-6 flex items-start gap-2.5 font-display text-xl font-semibold tracking-[-0.01em]">
                  <Icon className="mt-1 size-5 shrink-0 text-accent-200" aria-hidden="true" />
                  {benefit.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-navy-200">{benefit.text}</p>
              </li>
            );
          })}
        </ol>
        <p className="motion-reveal mt-16 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm leading-relaxed text-navy-200">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-200" aria-hidden="true" />
          {institutions.note}
        </p>
      </Container>
    </section>
  );
}
