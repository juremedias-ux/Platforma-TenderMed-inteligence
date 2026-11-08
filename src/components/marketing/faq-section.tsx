import { Plus } from "lucide-react";
import { Section } from "@/components/ui/section";
import { faq } from "@/data/marketing/faq";

/** Native <details> disclosure: keyboard accessible without JavaScript. */
export function FaqSection() {
  return (
    <Section id="vprasanja" eyebrow={faq.eyebrow} title={faq.title} tone="surface">
      <div className="mx-auto max-w-4xl divide-y divide-line border-y border-line">
        {faq.items.map((item) => (
          <details key={item.question} className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-5 text-left text-base font-semibold text-ink sm:text-lg">
              <h3>{item.question}</h3>
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-transform duration-200 group-open:rotate-45">
                <Plus className="size-4" aria-hidden="true" />
              </span>
            </summary>
            <p className="max-w-3xl pb-6 text-[15px] leading-relaxed text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
