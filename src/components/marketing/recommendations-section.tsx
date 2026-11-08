import { ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { RecommendationDetails } from "@/components/demo/recommendation-details";
import { ReviewLabelBadge } from "@/components/demo/status-badges";
import { recommendations as copy } from "@/data/marketing/home";
import { getCachedDemoSnapshot } from "@/features/demo/cached-snapshot";
import { recommendationKindLabels } from "@/features/recommendations/labels";

export async function RecommendationsSection() {
  const { dataset, recommendations } = await getCachedDemoSnapshot();
  // Example: the replacement candidate shows evidence, open checks and a paid-placement disclosure.
  const example = recommendations.find((r) => r.candidateId === "rec-02") ?? recommendations[0]!;
  const product = dataset.products.find((p) => p.id === example.productId)!;
  const manufacturer = dataset.manufacturers.find((m) => m.id === product.manufacturerId);
  const candidate = dataset.recommendationCandidates.find((c) => c.id === example.candidateId)!;

  return (
    <Section
      id="priporocila"
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={
        <>
          <p>{copy.positioning}</p>
          <p className="mt-3">{copy.intro}</p>
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{copy.factorsTitle}</h3>
          <ul className="mt-5 space-y-3">
            {copy.factors.map((factor) => (
              <li key={factor} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {factor}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-start gap-2.5 rounded-lg border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
            {copy.disclaimer}
          </p>
        </div>

        <article
          aria-labelledby="primer-priporocila"
          className="rounded-2xl border border-line-strong/70 bg-subtle p-4 shadow-raised sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone="warning" size="sm">
              Primer iz dema · izmišljen izdelek
            </Badge>
            <ReviewLabelBadge label={example.reviewLabel} />
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
            {recommendationKindLabels[candidate.kind]}
          </p>
          <h3 id="primer-priporocila" className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
            {product.name} {product.model}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">{manufacturer?.name} (izmišljen proizvajalec)</p>
          <div className="mt-5">
            <RecommendationDetails explanation={example} showEvidence={false} compact />
          </div>
          <Link
            href="/demo?pogled=priporocila"
            className="group mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-accent-700 hover:text-accent-800"
          >
            Oglejte si vsa priporočila v demu
            <ArrowRight
              className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </article>
      </div>
    </Section>
  );
}
