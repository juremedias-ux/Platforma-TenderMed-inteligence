import { documentTypeLabels } from "@/features/equipment/labels";
import type {
  RequirementMatchResult,
  SupplierAttribute,
  SupplierCapability,
  SupplierProfile,
  Tender,
  TenderMatchResult,
  TenderRequirement,
} from "@/types/domain";

/**
 * Deterministic demonstration rules for illustrative tenders.
 *
 * Each requirement resolves to exactly one of:
 *   - satisfied:             explicit evidence in the supplier profile meets it
 *   - not_satisfied:         explicit evidence shows it is not met
 *   - evidence_missing:      the profile does not contain the needed evidence
 *   - human_review_required: the requirement cannot be decided by rules
 *
 * Missing evidence is never treated as satisfied, and the overall label is
 * never a final eligibility decision: a person must review the notice.
 */

export const TENDER_RULES_VERSION = "demo-rules-1";

export const capabilityLabels: Record<SupplierCapability, string> = {
  user_training: "usposabljanje uporabnikov",
  rental_with_purchase_option: "najem z možnostjo odkupa",
  replacement_equipment_during_service: "nadomestna oprema med servisom",
  manufacturer_authorized_service: "pooblastilo proizvajalca za servis",
};

export const attributeLabels: Record<SupplierAttribute, { label: string; unit: string }> = {
  warrantyMonths: { label: "Garancija", unit: "mes." },
  serviceResponseHours: { label: "Odzivni čas servisa", unit: "h" },
  deliveryDays: { label: "Rok dobave", unit: "dni" },
};

function evaluateRequirement(requirement: TenderRequirement, profile: SupplierProfile): RequirementMatchResult {
  const { rule } = requirement;
  const result = (status: RequirementMatchResult["status"], explanation: string): RequirementMatchResult => ({
    requirementId: requirement.id,
    status,
    explanation,
  });

  switch (rule.kind) {
    case "document": {
      const label = documentTypeLabels[rule.documentType];
      return profile.documentTypes.includes(rule.documentType)
        ? result("satisfied", `Dokument je v profilu dobavitelja: ${label}.`)
        : result("evidence_missing", `V profilu dobavitelja ni dokumenta »${label}«. Dokaz manjka.`);
    }
    case "capability": {
      const label = capabilityLabels[rule.capability];
      const value = profile.capabilities[rule.capability];
      if (value === true) return result("satisfied", `Dobavitelj navaja, da zagotavlja: ${label}.`);
      if (value === false) return result("not_satisfied", `Dobavitelj navaja, da ne zagotavlja: ${label}.`);
      return result("evidence_missing", `Podatek ni naveden: ${label}.`);
    }
    case "min_value":
    case "max_value": {
      const { label, unit } = attributeLabels[rule.attribute];
      const value = profile.attributes[rule.attribute];
      if (value === undefined) return result("evidence_missing", `Podatek ni naveden: ${label.toLowerCase()}.`);
      const limit = rule.kind === "min_value" ? rule.min : rule.max;
      const meets = rule.kind === "min_value" ? value >= limit : value <= limit;
      const limitText = `${rule.kind === "min_value" ? "najmanj" : "največ"} ${limit} ${unit}`;
      return result(
        meets ? "satisfied" : "not_satisfied",
        `${label} po navedbi dobavitelja: ${value} ${unit} (zahteva: ${limitText}).`,
      );
    }
    case "manual_review":
      return result("human_review_required", `Pravila tega ne morejo presoditi: ${rule.reason}.`);
  }
}

export function evaluateTender(tender: Tender, profile: SupplierProfile): TenderMatchResult {
  const requirements = tender.requirements.map((r) => evaluateRequirement(r, profile));
  const open = requirements.filter((r) => r.status !== "satisfied");
  const missingEvidence = requirements
    .filter((r) => r.status === "evidence_missing")
    .map((r) => tender.requirements.find((req) => req.id === r.requirementId)?.description ?? r.requirementId);

  const label = open.length === 0 ? "suitable_for_further_review" : "additional_review_required";
  const summary =
    open.length === 0
      ? "Za vse zahteve je v profilu dobavitelja naveden dokaz. Končno presojo izpolnjevanja pogojev opravi človek na podlagi celotne razpisne dokumentacije."
      : `Zahteve z odprtimi vprašanji: ${open.length} od ${requirements.length}. Končno presojo izpolnjevanja pogojev opravi človek.`;

  return {
    tenderId: tender.id,
    label,
    requirements,
    missingEvidence,
    summary,
    engine: { kind: "deterministic_rules", version: TENDER_RULES_VERSION },
  };
}
