import type { CSSProperties } from "react";
import { Container } from "@/components/ui/container";
import { problem } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

const shift = (index: number) => ({ "--reveal-shift": `${(index % 3) * 4}%` }) as CSSProperties;

/** Section opened by a pinned, glowing statement word. */
export function ProblemSection() {
  return (
    <section id="izziv" aria-labelledby="izziv-naslov" className="relative overflow-x-clip bg-canvas text-ink">
      <div className="glow-scene">
        <div className="glow-sticky">
          <p aria-hidden="true" className="glow-word text-gradient font-display">
            {problem.statement}
          </p>
        </div>
      </div>
      <Container className="pb-24 sm:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="motion-reveal text-xs font-semibold tracking-[0.18em] text-accent-700 uppercase">Izziv</p>
          <h2
            id="izziv-naslov"
            className="motion-reveal mt-4 font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-5xl lg:text-6xl"
            style={shift(1)}
          >
            {problem.title}
          </h2>
          <p className="motion-reveal mt-6 text-lg leading-relaxed text-pretty text-ink-soft" style={shift(2)}>
            {problem.intro}
          </p>
        </div>
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problem.points.map((point, index) => {
            const Icon = getMarketingIcon(point.icon);
            return (
              <li
                key={point.title}
                className="motion-reveal rounded-3xl border border-line bg-surface p-7 shadow-card"
                style={shift(index)}
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-ink">{point.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{point.text}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
