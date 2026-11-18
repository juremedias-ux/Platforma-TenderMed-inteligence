import { BookOpenCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { howItWorks } from "@/data/marketing/home";
import { ScrollGallery } from "./scroll-gallery";

export function HowItWorksSection() {
  return (
    <section
      id="kako-deluje"
      aria-labelledby="kako-deluje-naslov"
      className="relative overflow-x-clip border-t border-white/10 bg-navy-950 py-24 text-white sm:py-32"
    >
      <Container>
        <p className="motion-reveal text-xs font-semibold tracking-[0.18em] text-accent-200 uppercase">
          {howItWorks.eyebrow}
        </p>
        <h2
          id="kako-deluje-naslov"
          className="motion-reveal mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl"
        >
          {howItWorks.title}
        </h2>
        <ScrollGallery label="Koraki" className="motion-reveal mt-14">
          {howItWorks.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex w-[82%] shrink-0 flex-col rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 sm:w-[24rem] lg:min-h-[22rem]"
            >
              <span aria-hidden="true" className="text-gradient font-display text-5xl leading-none font-semibold">
                {index + 1}
              </span>
              <span className="mt-6 text-xs font-semibold tracking-[0.14em] text-accent-200 uppercase">
                Korak {index + 1}
              </span>
              <h3 className="mt-3 font-display text-2xl leading-snug font-semibold tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-navy-200">{step.text}</p>
            </li>
          ))}
        </ScrollGallery>
        <p className="motion-reveal mt-10 flex max-w-3xl items-start gap-2.5 text-sm leading-relaxed text-navy-200">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-accent-200" aria-hidden="true" />
          {howItWorks.note}
        </p>
      </Container>
    </section>
  );
}
