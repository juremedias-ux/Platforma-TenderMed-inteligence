import { Info } from "lucide-react";
import { Section } from "@/components/ui/section";
import { serviceModels } from "@/data/marketing/home";
import { getMarketingIcon } from "./icons";

export function ServiceModelsSection() {
  return (
    <Section id="storitve" eyebrow={serviceModels.eyebrow} title={serviceModels.title} intro={serviceModels.intro}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {serviceModels.items.map((item) => {
          const Icon = getMarketingIcon(item.icon);
          return (
            <li key={item.label} className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[15px] font-medium text-ink">{item.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 flex max-w-3xl items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
        {serviceModels.qualification}
      </p>
    </Section>
  );
}
