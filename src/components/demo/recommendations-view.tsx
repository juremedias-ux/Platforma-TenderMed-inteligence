"use client";

import { Bookmark, BookmarkCheck, CircleHelp, Cpu, ThumbsDown, Undo2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { countByReviewState } from "@/features/demo/selectors";
import {
  commercialDisclosure,
  compatibilityStatusLabels,
  recommendationKindLabels,
  reviewStateLabels,
} from "@/features/recommendations/labels";
import { cn } from "@/lib/utils/cn";
import { pluralSl } from "@/lib/utils/plural";
import type { MatchExplanation, RecommendationReviewState } from "@/types/domain";
import { useDemo } from "./demo-context";
import { EmptyState } from "./demo-shared";
import { RecommendationDetails } from "./recommendation-details";
import { ReviewLabelBadge } from "./status-badges";

type Filter = "active" | RecommendationReviewState;

const filterLabels: Record<Filter, string> = {
  active: "Za pregled",
  new: "Nova",
  saved: "Shranjena",
  dismissed: "Ni relevantno",
};

export function RecommendationsView() {
  const { snapshot, state } = useDemo();
  const [filter, setFilter] = useState<Filter>("active");
  const [explained, setExplained] = useState<MatchExplanation | null>(null);
  const counts = countByReviewState(state.recommendationStates);
  const filterCounts: Record<Filter, number> = {
    active: counts.new + counts.saved,
    new: counts.new,
    saved: counts.saved,
    dismissed: counts.dismissed,
  };

  const visible = snapshot.recommendations.filter((r) => {
    const reviewState = state.recommendationStates[r.candidateId] ?? "new";
    return filter === "active" ? reviewState !== "dismissed" : reviewState === filter;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink-soft shadow-card">
        <Cpu className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
        <p>
          Predlogi so rezultat preglednih, vnaprej določenih pravil v demonstraciji (različica pravil{" "}
          {snapshot.engine.version}) – ne gre za umetno inteligenco. Ne vsebujejo ocene medicinske primernosti. Plačana
          predstavitev ne vpliva na oznako, vrstni red ali prikaz manjkajočih podatkov.
        </p>
      </div>

      <div role="group" aria-label="Filter priporočil" className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === key
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-navy-300",
            )}
          >
            {filterLabels[key]} <span className="tabular-nums opacity-75">({filterCounts[key]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="V tem pogledu ni priporočil."
          text={filter === "dismissed" ? "Nobenega predloga niste označili kot nerelevantnega." : undefined}
        />
      ) : (
        <ul className="grid gap-4 2xl:grid-cols-2">
          {visible.map((explanation) => (
            <li key={explanation.candidateId}>
              <RecommendationCard explanation={explanation} onExplain={() => setExplained(explanation)} />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(explained)} onOpenChange={(open) => (!open ? setExplained(null) : undefined)}>
        {explained ? (
          <DialogContent className="max-w-3xl" closeLabel="Zapri razlago">
            <ExplanationDialogBody explanation={explained} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function useProductInfo(explanation: MatchExplanation) {
  const { snapshot } = useDemo();
  const product = snapshot.dataset.products.find((p) => p.id === explanation.productId)!;
  const manufacturer = snapshot.dataset.manufacturers.find((m) => m.id === product.manufacturerId);
  const candidate = snapshot.dataset.recommendationCandidates.find((c) => c.id === explanation.candidateId)!;
  return { product, manufacturer, candidate };
}

function RecommendationCard({ explanation, onExplain }: { explanation: MatchExplanation; onExplain: () => void }) {
  const { state, dispatch, announce } = useDemo();
  const { product, manufacturer, candidate } = useProductInfo(explanation);
  const reviewState = state.recommendationStates[explanation.candidateId] ?? "new";
  const disclosure = commercialDisclosure[explanation.commercialRelationship];
  const productName = `${product.name} ${product.model}`;

  const setState = (next: RecommendationReviewState, message: string) => {
    dispatch({ type: "set_recommendation_state", candidateId: explanation.candidateId, state: next });
    announce(message);
  };

  const rows = [
    { label: "Relevantna potreba", value: explanation.relevance.reasons[0] ?? "Relevantnost ni ugotovljena." },
    {
      label: "Razpoložljivi dokazi",
      value:
        explanation.evidence.length > 0
          ? `${explanation.evidence.length} ${pluralSl(explanation.evidence.length, ["zabeležen vir", "zabeležena vira", "zabeleženi viri", "zabeleženih virov"])}`
          : "Ni zabeleženih dokazov",
    },
    {
      label: "Manjkajoči podatki",
      value:
        explanation.missingInformation.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {explanation.missingInformation.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {explanation.missingInformation.length > 3 ? (
              <li>in še {explanation.missingInformation.length - 3} (glejte razlago)</li>
            ) : null}
          </ul>
        ) : (
          "Ni zabeleženih"
        ),
    },
    { label: "Združljivost", value: compatibilityStatusLabels[explanation.compatibility.status] },
    { label: "Komercialna povezava", value: disclosure.label },
    { label: "Predlagani naslednji korak", value: explanation.suggestedNextStep },
  ];

  return (
    <article
      aria-label={productName}
      className={cn(
        "flex h-full flex-col rounded-lg border bg-surface shadow-card",
        reviewState === "dismissed" ? "border-dashed border-line-strong opacity-80" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.08em] text-ink-muted uppercase">
            {recommendationKindLabels[candidate.kind]}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">{productName}</h3>
          <p className="text-[13px] text-ink-muted">{manufacturer?.name} · izmišljen izdelek</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ReviewLabelBadge label={explanation.reviewLabel} size="sm" />
          <Badge tone={reviewState === "saved" ? "accent" : "outline"} size="sm">
            {reviewStateLabels[reviewState]}
          </Badge>
        </div>
      </div>

      <dl className="flex-1 divide-y divide-line px-4 sm:px-5">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-[13px] text-ink-muted">{row.label}</dt>
            <dd className="text-ink-soft">{row.value}</dd>
          </div>
        ))}
      </dl>

      {explanation.commercialRelationship !== "none_declared" ? (
        <p className="mx-4 mb-3 rounded-md bg-subtle px-3 py-2 text-xs leading-relaxed text-ink-soft sm:mx-5">
          <span className="font-semibold text-ink">Razkritje: </span>
          {disclosure.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line p-4 sm:px-5">
        {reviewState === "dismissed" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setState("new", `Predlog ${productName} je znova med predlogi za pregled.`)}
          >
            <Undo2 aria-hidden="true" />
            Razveljavi
          </Button>
        ) : (
          <>
            <Button
              variant={reviewState === "saved" ? "accent" : "secondary"}
              size="sm"
              aria-pressed={reviewState === "saved"}
              onClick={() =>
                reviewState === "saved"
                  ? setState("new", `Predlog ${productName} ni več shranjen.`)
                  : setState("saved", `Predlog ${productName} je shranjen za pregled.`)
              }
            >
              {reviewState === "saved" ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
              {reviewState === "saved" ? "Shranjeno za pregled" : "Shrani za pregled"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState("dismissed", `Predlog ${productName} je označen kot ni relevantno.`)}
            >
              <ThumbsDown aria-hidden="true" />
              Ni relevantno
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onExplain} className="sm:ml-auto">
          <CircleHelp aria-hidden="true" />
          Zakaj ta predlog?
        </Button>
      </div>
    </article>
  );
}

function ExplanationDialogBody({ explanation }: { explanation: MatchExplanation }) {
  const { product, manufacturer } = useProductInfo(explanation);
  return (
    <>
      <DialogTitle>
        Zakaj ta predlog? {product.name} {product.model}
      </DialogTitle>
      <DialogDescription>
        {manufacturer?.name} · izmišljen izdelek. Razlago je pripravil pregleden sklop pravil v demonstraciji. Predlog
        ni ocena primernosti za klinično uporabo.
      </DialogDescription>
      <div className="mt-4 flex flex-wrap gap-2">
        <ReviewLabelBadge label={explanation.reviewLabel} />
      </div>
      <div className="mt-5">
        <RecommendationDetails explanation={explanation} />
      </div>
    </>
  );
}
