import { diffInDays, fullYearsBetween, type IsoDate } from "@/lib/dates/date-only";
import { formatEur } from "@/lib/utils/format-number";
import { countDevices, countYears } from "@/lib/utils/plural";
import type {
  CompatibilityAssessment,
  DocumentMetadata,
  Equipment,
  EvidenceItem,
  MatchExplanation,
  OrganizationService,
  Product,
  RecommendationCandidate,
  RecommendationReviewLabel,
  ReplacementConsideration,
  ServiceEvent,
  StatedNeed,
} from "@/types/domain";

/**
 * Deterministic demonstration rules for product recommendations.
 *
 * The rules keep five concerns separate:
 *   1. relevance to the organization's services and stated needs,
 *   2. technical compatibility (only from explicit declarations),
 *   3. documentation availability,
 *   4. repair-or-replace considerations for existing equipment,
 *   5. commercial relationship (disclosed, never used for ranking).
 *
 * Unknown compatibility stays "unknown" and missing evidence is listed —
 * neither is ever converted into a positive match. No medical suitability
 * score or probability of clinical benefit is produced.
 */

export const RECOMMENDATION_RULES_VERSION = "demo-rules-1";

/** Share of the replacement value above which recorded service costs are mentioned. */
export const SERVICE_COST_SHARE_THRESHOLD = 0.4;
/** Look-back window for service costs and repairs. */
export const SERVICE_COST_WINDOW_DAYS = 730;

export const REPLACEMENT_STATEMENT = "Smiselna je presoja možnosti popravila ali zamenjave.";
export const REPLACEMENT_CAVEAT =
  "Starost naprave ali stroški servisa sami po sebi ne pomenijo, da naprava ni varna ali da jo je treba zamenjati.";

export interface RecommendationContext {
  referenceDate: IsoDate;
  candidates: RecommendationCandidate[];
  products: Product[];
  documents: DocumentMetadata[];
  equipment: Equipment[];
  serviceEvents: ServiceEvent[];
  services: OrganizationService[];
  needs: StatedNeed[];
}

const reviewLabelPriority: Record<RecommendationReviewLabel, number> = {
  worth_review: 0,
  compatibility_check_needed: 1,
  insufficient_data: 2,
  not_compatible: 3,
};

function assessRelevance(
  candidate: RecommendationCandidate,
  product: Product,
  context: RecommendationContext,
): MatchExplanation["relevance"] {
  const reasons: string[] = [];

  for (const needId of candidate.relatedNeedIds) {
    const need = context.needs.find((n) => n.id === needId);
    if (need) reasons.push(`Ustanova je navedla potrebo: »${need.description}«.`);
  }

  for (const serviceId of candidate.relatedServiceIds) {
    const service = context.services.find((s) => s.id === serviceId);
    if (service && product.supportedServiceCategories.includes(service.category)) {
      reasons.push(`Ustanova izvaja storitev »${service.name}«, s katero proizvajalec povezuje izdelek.`);
    }
  }

  const relatedEquipment = context.equipment.filter((e) => candidate.relatedEquipmentIds.includes(e.id));
  if (relatedEquipment.length > 0 && candidate.kind !== "emerging_solution") {
    const first = relatedEquipment[0]!;
    reasons.push(
      `Povezano z opremo v evidenci: ${first.name.toLowerCase()} ${first.model} (${countDevices(relatedEquipment.length)}).`,
    );
  }

  return { established: reasons.length > 0, reasons };
}

function assessCompatibility(candidate: RecommendationCandidate, product: Product): CompatibilityAssessment {
  if (candidate.compatibilityTargets.length === 0) {
    return { status: "not_applicable", details: [] };
  }

  const details = candidate.compatibilityTargets.map((target) => {
    const declaration = product.compatibility.find((d) => d.targetModel === target.model);
    return declaration
      ? { target: target.label, status: declaration.status, documentId: declaration.source.documentId }
      : { target: target.label, status: "unknown" as const };
  });

  const status = details.some((d) => d.status === "incompatible")
    ? "incompatible"
    : details.some((d) => d.status === "unknown")
      ? "unknown"
      : "confirmed";

  return { status, details };
}

function sumRecentServiceCosts(events: ServiceEvent[], referenceDate: IsoDate) {
  const recent = events.filter((event) => {
    const age = diffInDays(event.date, referenceDate);
    return age >= 0 && age <= SERVICE_COST_WINDOW_DAYS;
  });
  const recordedCosts = recent.filter((e) => e.costEur !== null);
  return {
    total: recordedCosts.reduce((sum, e) => sum + (e.costEur ?? 0), 0),
    repairs: recent.filter((e) => e.types.includes("repair")).length,
    hasCosts: recordedCosts.length > 0,
  };
}

function assessReplacement(
  candidate: RecommendationCandidate,
  context: RecommendationContext,
  missing: string[],
): ReplacementConsideration | null {
  if (candidate.kind !== "replacement_candidate") return null;

  const reasons: string[] = [];
  for (const equipment of context.equipment.filter((e) => candidate.relatedEquipmentIds.includes(e.id))) {
    const label = `${equipment.name} ${equipment.model} (${equipment.serialNumber})`;
    const age = fullYearsBetween(equipment.purchaseDate, context.referenceDate);

    if (equipment.expectedServiceLifeYears === undefined) {
      missing.push(`Pričakovana življenjska doba naprave ${label} po navedbi proizvajalca`);
    } else if (age >= equipment.expectedServiceLifeYears) {
      reasons.push(
        `${label}: v uporabi ${countYears(age)}, proizvajalec navaja pričakovano življenjsko dobo ${countYears(equipment.expectedServiceLifeYears)}.`,
      );
    }

    const costs = sumRecentServiceCosts(
      context.serviceEvents.filter((e) => e.equipmentId === equipment.id),
      context.referenceDate,
    );
    if (costs.repairs >= 2) {
      reasons.push(`Število popravil v zadnjih 24 mesecih: ${costs.repairs}.`);
    }
    if (equipment.replacementValueEur === undefined) {
      missing.push(`Okvirna nadomestna vrednost naprave ${label}`);
    } else if (costs.hasCosts && costs.total >= equipment.replacementValueEur * SERVICE_COST_SHARE_THRESHOLD) {
      const share = Math.round((costs.total / equipment.replacementValueEur) * 100);
      reasons.push(
        `Zabeleženi stroški servisa v zadnjih 24 mesecih: ${formatEur(costs.total)} (${share} % okvirne nadomestne vrednosti).`,
      );
    }
  }

  return { applies: reasons.length > 0, reasons, caveat: REPLACEMENT_CAVEAT };
}

function decideLabel(
  relevance: MatchExplanation["relevance"],
  compatibility: CompatibilityAssessment,
  hasCriticalGaps: boolean,
): RecommendationReviewLabel {
  if (compatibility.status === "incompatible") return "not_compatible";
  if (hasCriticalGaps || !relevance.established) return "insufficient_data";
  if (compatibility.status === "unknown") return "compatibility_check_needed";
  return "worth_review";
}

function nextStepFor(label: RecommendationReviewLabel, compatibility: CompatibilityAssessment): string {
  switch (label) {
    case "worth_review":
      return "Preglejte dokumentacijo proizvajalca in se odločite, ali želite zahtevati predstavitev ali ponudbo.";
    case "compatibility_check_needed": {
      const targets = compatibility.details.filter((d) => d.status === "unknown").map((d) => d.target);
      return `Pri proizvajalcu ali dobavitelju zahtevajte pisno potrditev združljivosti: ${targets.join(", ")}.`;
    }
    case "insufficient_data":
      return "Pred nadaljnjo obravnavo pridobite manjkajoče podatke in dokumentacijo.";
    case "not_compatible":
      return "Po razpoložljivi dokumentaciji izdelek ni združljiv z navedeno opremo. Brez nove dokumentacije nadaljnji pregled ni smiseln.";
  }
}

export function evaluateRecommendation(
  candidate: RecommendationCandidate,
  context: RecommendationContext,
): MatchExplanation {
  const product = context.products.find((p) => p.id === candidate.productId);
  if (!product) {
    throw new Error(`Unknown product ${candidate.productId} for candidate ${candidate.id}`);
  }

  const productDocuments = context.documents.filter((d) => product.documentIds.includes(d.id));
  const hasDocument = (type: DocumentMetadata["type"]) => productDocuments.some((d) => d.type === type);

  const relevance = assessRelevance(candidate, product, context);
  const compatibility = assessCompatibility(candidate, product);

  const evidence: EvidenceItem[] = productDocuments.map((doc) => ({
    label: `${doc.title} (metapodatek)`,
    documentId: doc.id,
  }));
  if (product.intendedUse) {
    evidence.push({
      label: `Predvidena uporaba po navedbi proizvajalca: ${product.intendedUse.summary}`,
      documentId: product.intendedUse.source.documentId,
    });
  }
  for (const detail of compatibility.details.filter((d) => d.status === "confirmed")) {
    evidence.push({
      label: `Združljivost potrjena v dokumentaciji proizvajalca: ${detail.target}`,
      documentId: detail.documentId,
    });
  }
  if (product.marketAvailability.slovenia === "available") {
    evidence.push({ label: "Ponudnik navaja, da je izdelek na voljo v Sloveniji." });
  }
  if (product.marketAvailability.localServiceAvailable === true) {
    evidence.push({ label: "Ponudnik navaja lokalno servisno podporo." });
  }

  const missing: string[] = [];
  const criticalGaps: string[] = [];
  if (!product.intendedUse) criticalGaps.push("Izjava proizvajalca o predvideni uporabi");
  if (!hasDocument("instructions_for_use") && !hasDocument("instructions_for_use_sl")) {
    criticalGaps.push("Navodila za uporabo");
  }
  if (product.verificationStatus === "unverified") {
    criticalGaps.push("Pregled dokumentacije s strani platforme še ni opravljen");
  }
  missing.push(...criticalGaps);
  if (!hasDocument("declaration_of_conformity")) {
    missing.push("Izjava o skladnosti ali drug dokaz o regulativnem statusu izdelka");
  }
  if (product.marketAvailability.slovenia === "unknown") missing.push("Razpoložljivost na slovenskem trgu");
  if (product.marketAvailability.localServiceAvailable === undefined)
    missing.push("Podatki o lokalni servisni podpori");
  for (const detail of compatibility.details.filter((d) => d.status === "unknown")) {
    missing.push(`Potrditev združljivosti: ${detail.target}`);
  }

  const replacement = assessReplacement(candidate, context, missing);
  const reviewLabel = decideLabel(relevance, compatibility, criticalGaps.length > 0);

  return {
    candidateId: candidate.id,
    productId: product.id,
    reviewLabel,
    relevance,
    compatibility,
    evidence,
    missingInformation: missing,
    replacement,
    commercialRelationship: product.commercialRelationship,
    suggestedNextStep: nextStepFor(reviewLabel, compatibility),
    engine: { kind: "deterministic_rules", version: RECOMMENDATION_RULES_VERSION },
  };
}

/**
 * Evaluates all candidates and orders them by review label, then by product
 * name. The commercial relationship is deliberately not part of the order.
 */
export function evaluateRecommendations(context: RecommendationContext): MatchExplanation[] {
  const productName = (id: string) => {
    const p = context.products.find((product) => product.id === id);
    return p ? `${p.name} ${p.model}` : id;
  };
  return context.candidates
    .map((candidate) => evaluateRecommendation(candidate, context))
    .sort(
      (a, b) =>
        reviewLabelPriority[a.reviewLabel] - reviewLabelPriority[b.reviewLabel] ||
        productName(a.productId).localeCompare(productName(b.productId), "sl"),
    );
}
