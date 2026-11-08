import { Check } from "lucide-react";
import { PilotInquiryForm } from "@/components/forms/pilot-inquiry-form";
import { Container } from "@/components/ui/container";
import { pilot } from "@/data/marketing/home";

export function PilotSection() {
  return (
    <section id="pilot" aria-labelledby="pilot-naslov" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">{pilot.eyebrow}</p>
            <h2
              id="pilot-naslov"
              className="font-display text-3xl font-semibold tracking-[-0.02em] text-balance text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
            >
              {pilot.title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-pretty text-ink-soft sm:text-lg">{pilot.text}</p>
            <div className="mt-10 rounded-xl border border-line bg-surface p-6">
              <h3 className="text-sm font-semibold text-ink">{pilot.sideTitle}</h3>
              <ul className="mt-4 space-y-3">
                {pilot.sidePoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-raised sm:p-8">
            <h3 className="mb-6 font-display text-xl font-semibold text-ink">
              Prijava interesa za pilot ali predstavitev
            </h3>
            <PilotInquiryForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
