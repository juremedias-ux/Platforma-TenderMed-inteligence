import { createDemoDataset, type DemoDataset } from "@/data/demo";
import { createDeterministicMatchingEngine, type MatchingEngine } from "@/features/matching/engine";
import type { IsoDate } from "@/lib/dates/date-only";
import type { MatchExplanation, TenderMatchResult } from "@/types/domain";

/** Everything the demo workspace needs, computed on the server. */
export interface DemoSnapshot {
  dataset: DemoDataset;
  recommendations: MatchExplanation[];
  tenderMatches: TenderMatchResult[];
  engine: MatchingEngine["descriptor"];
}

export async function loadDemoSnapshot(
  referenceDate: IsoDate,
  engine: MatchingEngine = createDeterministicMatchingEngine(),
): Promise<DemoSnapshot> {
  const dataset = createDemoDataset(referenceDate);
  const [recommendations, tenderMatches] = await Promise.all([
    engine.evaluateRecommendations({
      referenceDate,
      candidates: dataset.recommendationCandidates,
      products: dataset.products,
      documents: dataset.documents,
      equipment: dataset.equipment,
      serviceEvents: dataset.serviceEvents,
      services: dataset.services,
      needs: dataset.needs,
    }),
    engine.evaluateTenders({ tenders: dataset.tenders, supplier: dataset.supplier }),
  ]);
  return { dataset, recommendations, tenderMatches, engine: engine.descriptor };
}
