import { Check, LockKeyhole } from "lucide-react";
import { Section } from "@/components/ui/section";
import { partners } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

export function PartnersSection() {
  return (
    <Section id="za-partnerje" eyebrow={partners.eyebrow} title={partners.title} intro={partners.intro} tone="navy">
      <div className="grid gap-5 lg:grid-cols-2">
        {partners.cards.map((card, index) => {
          const Icon = getMarketingIcon(card.icon);
          return (
            <article
              key={card.title}
              className={
                index === 0
                  ? "rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-8"
                  : "rounded-2xl border border-accent-500/30 bg-accent-800/25 p-7 sm:p-8"
              }
            >
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-white text-navy-900">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.01em] text-white">{card.title}</h3>
              <ul className="mt-6 space-y-3.5">
                {card.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-navy-200">
                    <Check className="mt-1 size-4 shrink-0 text-accent-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="mt-8 flex max-w-4xl items-start gap-3 rounded-xl border border-white/10 bg-navy-950/50 px-5 py-4 text-sm leading-relaxed text-navy-200">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
        {partners.accessNote}
      </p>
    </Section>
  );
}
