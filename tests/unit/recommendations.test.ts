import { describe, expect, it } from "vitest";
import { createDemoDataset } from "@/data/demo";
import {
  REPLACEMENT_CAVEAT,
  evaluateRecommendation,
  evaluateRecommendations,
  type RecommendationContext,
} from "@/features/recommendations/rules";
import { createDeterministicMatchingEngine } from "@/features/matching/engine";
import type { CommercialRelationship, Product, RecommendationCandidate } from "@/types/domain";

const REFERENCE = "2026-11-08";

function contextFor(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  const dataset = createDemoDataset(REFERENCE);
  return {
    referenceDate: REFERENCE,
    candidates: dataset.recommendationCandidates,
    products: dataset.products,
    documents: dataset.documents,
    equipment: dataset.equipment,
    serviceEvents: dataset.serviceEvents,
    services: dataset.services,
    needs: dataset.needs,
    ...overrides,
  };
}

function evaluate(candidateId: string, context = contextFor()) {
  const candidate = context.candidates.find((c) => c.id === candidateId)!;
  return evaluateRecommendation(candidate, context);
}

describe("recommendation explanations", () => {
  it("explains a compatible accessory with documented evidence", () => {
    const result = evaluate("rec-01");
    expect(result.reviewLabel).toBe("worth_review");
    expect(result.compatibility.status).toBe("confirmed");
    expect(result.compatibility.details[0]).toMatchObject({ status: "confirmed", documentId: "doc-prd-bp20-compat" });
    expect(result.relevance.reasons.join(" ")).toContain("Daljše delovanje monitorjev");
    expect(result.evidence.some((e) => e.documentId === "doc-prd-bp20-compat")).toBe(true);
    expect(result.commercialRelationship).toBe("partner_listing");
    expect(result.engine.kind).toBe("deterministic_rules");
  });

  it("keeps unknown compatibility unknown and lists it as missing information", () => {
    const result = evaluate("rec-02");
    expect(result.compatibility.status).toBe("unknown");
    expect(result.compatibility.details).toEqual([
      { target: "infuzijski sistemi IS-20, ki jih ustanova uporablja", status: "unknown" },
    ]);
    expect(result.reviewLabel).toBe("compatibility_check_needed");
    expect(result.missingInformation).toContain(
      "Potrditev združljivosti: infuzijski sistemi IS-20, ki jih ustanova uporablja",
    );
    expect(result.suggestedNextStep).toContain("pisno potrditev združljivosti");
  });

  it("frames replacement as a repair-or-replace assessment with a safety caveat", () => {
    const result = evaluate("rec-02");
    expect(result.replacement?.applies).toBe(true);
    expect(result.replacement?.caveat).toBe(REPLACEMENT_CAVEAT);
    const reasons = result.replacement?.reasons.join(" ") ?? "";
    expect(reasons).toContain("pričakovano življenjsko dobo 8 let");
    expect(reasons).toContain("Število popravil v zadnjih 24 mesecih: 3.");
    expect(reasons).toMatch(/1650\s€/u);
    expect(reasons.toLowerCase()).not.toContain("nevarn");
    expect(reasons.toLowerCase()).not.toContain("ni varn");
  });

  it("does not turn missing documentation into a positive match", () => {
    const result = evaluate("rec-04");
    expect(result.reviewLabel).toBe("insufficient_data");
    expect(result.compatibility.status).toBe("unknown");
    expect(result.missingInformation).toEqual(
      expect.arrayContaining([
        "Izjava proizvajalca o predvideni uporabi",
        "Navodila za uporabo",
        "Pregled dokumentacije s strani platforme še ni opravljen",
        "Razpoložljivost na slovenskem trgu",
      ]),
    );
  });

  it("lists non-critical gaps without hiding a relevant service-related product", () => {
    const result = evaluate("rec-03");
    expect(result.reviewLabel).toBe("worth_review");
    expect(result.compatibility.status).toBe("not_applicable");
    expect(result.missingInformation).toContain("Podatki o lokalni servisni podpori");
    expect(result.relevance.reasons.join(" ")).toContain("Ambulantna fizioterapija");
  });

  it("never produces a numeric suitability score", () => {
    for (const result of evaluateRecommendations(contextFor())) {
      expect(Object.keys(result)).not.toContain("score");
      expect(JSON.stringify(result)).not.toMatch(/verjetnost|probability|score/i);
    }
  });
});

describe("commercial neutrality", () => {
  const relationships: CommercialRelationship[] = [
    "none_declared",
    "platform_operator_distributes",
    "partner_listing",
    "sponsored",
  ];

  function withRelationship(relationship: CommercialRelationship) {
    const base = contextFor();
    return contextFor({
      products: base.products.map((p) => ({ ...p, commercialRelationship: relationship })),
    });
  }

  it("produces the same labels and order regardless of the commercial relationship", () => {
    const baseline = evaluateRecommendations(contextFor()).map((r) => [r.candidateId, r.reviewLabel]);
    for (const relationship of relationships) {
      const results = evaluateRecommendations(withRelationship(relationship));
      expect(results.map((r) => [r.candidateId, r.reviewLabel])).toEqual(baseline);
      expect(results.every((r) => r.commercialRelationship === relationship)).toBe(true);
    }
  });

  it("does not let a sponsored listing override documented incompatibility", () => {
    const base = contextFor();
    const incompatibleSponsored: Product = {
      ...base.products.find((p) => p.id === "prd-bp20")!,
      id: "prd-sponsored-x",
      model: "BP-99",
      commercialRelationship: "sponsored",
      compatibility: [{ targetModel: "VM-200", status: "incompatible", source: { documentId: "doc-prd-bp20-compat" } }],
    };
    const candidate: RecommendationCandidate = {
      ...base.candidates.find((c) => c.id === "rec-01")!,
      id: "rec-sponsored",
      productId: incompatibleSponsored.id,
    };
    const context = contextFor({
      products: [...base.products, incompatibleSponsored],
      candidates: [...base.candidates, candidate],
    });
    const results = evaluateRecommendations(context);
    const sponsored = results.find((r) => r.candidateId === "rec-sponsored")!;
    expect(sponsored.reviewLabel).toBe("not_compatible");
    expect(results.at(-1)?.candidateId).toBe("rec-sponsored");
  });
});

describe("matching engine adapter", () => {
  it("exposes deterministic rules through the async adapter interface", async () => {
    const engine = createDeterministicMatchingEngine();
    expect(engine.descriptor.kind).toBe("deterministic_rules");
    const results = await engine.evaluateRecommendations(contextFor());
    expect(results.map((r) => r.candidateId)).toEqual(["rec-01", "rec-03", "rec-02", "rec-04"]);
  });
});
