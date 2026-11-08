import {
  RECOMMENDATION_RULES_VERSION,
  evaluateRecommendations,
  type RecommendationContext,
} from "@/features/recommendations/rules";
import { TENDER_RULES_VERSION, evaluateTender } from "@/features/tenders/rules";
import type { MatchExplanation, SupplierProfile, Tender, TenderMatchResult } from "@/types/domain";

export interface TenderContext {
  tenders: Tender[];
  supplier: SupplierProfile;
}

/**
 * Adapter boundary between matching logic and the UI.
 *
 * The UI only consumes `MatchExplanation` and `TenderMatchResult`. A future
 * model-assisted engine can implement this interface server-side (with the
 * same explainable output and mandatory human review) without UI changes.
 * The interface is asynchronous for that reason, even though the current
 * implementation is synchronous and deterministic.
 */
export interface MatchingEngine {
  readonly descriptor: {
    kind: "deterministic_rules" | "external_model";
    version: string;
  };
  evaluateRecommendations(context: RecommendationContext): Promise<MatchExplanation[]>;
  evaluateTenders(context: TenderContext): Promise<TenderMatchResult[]>;
}

/** The only engine in this release: transparent rules, no external AI calls. */
export function createDeterministicMatchingEngine(): MatchingEngine {
  return {
    descriptor: {
      kind: "deterministic_rules",
      version:
        RECOMMENDATION_RULES_VERSION === TENDER_RULES_VERSION
          ? RECOMMENDATION_RULES_VERSION
          : `${RECOMMENDATION_RULES_VERSION}/${TENDER_RULES_VERSION}`,
    },
    async evaluateRecommendations(context) {
      return evaluateRecommendations(context);
    },
    async evaluateTenders({ tenders, supplier }) {
      return tenders.map((tender) => evaluateTender(tender, supplier));
    },
  };
}
