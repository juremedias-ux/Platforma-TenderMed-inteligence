import type {
  CommercialRelationship,
  CompatibilityStatus,
  RecommendationKind,
  RecommendationReviewLabel,
  RecommendationReviewState,
  RequirementMatchStatus,
  TenderMatchLabel,
} from "@/types/domain";

export const reviewLabelText: Record<RecommendationReviewLabel, string> = {
  worth_review: "Smiselno za nadaljnji pregled",
  compatibility_check_needed: "Potrebno preverjanje združljivosti",
  insufficient_data: "Premalo podatkov",
  not_compatible: "Ni združljivo po dokumentaciji",
};

export const recommendationKindLabels: Record<RecommendationKind, string> = {
  complementary_accessory: "Dopolnilna dodatna oprema",
  replacement_candidate: "Možnost zamenjave",
  service_expansion: "Povezano s storitvijo ustanove",
  emerging_solution: "Nova rešitev",
};

export const compatibilityStatusLabels: Record<CompatibilityStatus, string> = {
  confirmed: "Potrjena v dokumentaciji",
  incompatible: "Ni združljivo",
  unknown: "Neznana",
  not_applicable: "Ni relevantno",
};

export const reviewStateLabels: Record<RecommendationReviewState, string> = {
  new: "Čaka na pregled",
  saved: "Shranjeno za pregled",
  dismissed: "Označeno kot ni relevantno",
};

/** Disclosure text rendered next to every recommendation. */
export const commercialDisclosure: Record<CommercialRelationship, { label: string; text: string }> = {
  none_declared: {
    label: "Komercialna povezava ni prijavljena",
    text: "Ponudnik ni prijavil komercialne povezave z upravljavcem platforme.",
  },
  platform_operator_distributes: {
    label: "Upravljavec platforme izdelek distribuira",
    text: "Upravljavec platforme ta izdelek tudi distribuira. To ne vpliva na oceno ustreznosti ali na prikaz manjkajočih podatkov.",
  },
  partner_listing: {
    label: "Partnerski vpis",
    text: "Izdelek je vpisan prek partnerskega profila ponudnika. Vpis ne vpliva na oceno ustreznosti.",
  },
  sponsored: {
    label: "Plačana predstavitev",
    text: "Ponudnik je plačal predstavitev. Plačilo ne vpliva na oceno ustreznosti, vrstni red ali prikaz manjkajočih podatkov.",
  },
};

export const requirementStatusLabels: Record<RequirementMatchStatus, string> = {
  satisfied: "Izpolnjeno",
  not_satisfied: "Ni izpolnjeno",
  evidence_missing: "Dokaz manjka",
  human_review_required: "Potreben človeški pregled",
};

export const tenderLabelText: Record<TenderMatchLabel, string> = {
  suitable_for_further_review: "Primerno za nadaljnji pregled",
  additional_review_required: "Potreben dodaten pregled",
};
