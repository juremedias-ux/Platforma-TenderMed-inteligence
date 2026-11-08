import type { RecommendationCandidate } from "@/types/domain";
import { DEMO_ORGANIZATION_ID as ORG } from "./organization";

/**
 * Fictional recommendation candidates. Each pairs a fictional product with
 * the demo organization's context. The matching engine — not this file —
 * decides the review label, evidence and missing information.
 */
export const demoRecommendationCandidates: RecommendationCandidate[] = [
  {
    id: "rec-01",
    organizationId: ORG,
    productId: "prd-bp20",
    kind: "complementary_accessory",
    relatedEquipmentIds: ["eq-01", "eq-02"],
    relatedNeedIds: ["need-transport"],
    relatedServiceIds: ["svc-inpatient"],
    compatibilityTargets: [{ model: "VM-200", label: "monitorji vitalnih funkcij VM-200" }],
  },
  {
    id: "rec-02",
    organizationId: ORG,
    productId: "prd-ip5",
    kind: "replacement_candidate",
    relatedEquipmentIds: ["eq-03"],
    relatedNeedIds: ["need-infusion"],
    relatedServiceIds: ["svc-inpatient"],
    compatibilityTargets: [{ model: "IS-20", label: "infuzijski sistemi IS-20, ki jih ustanova uporablja" }],
  },
  {
    id: "rec-03",
    organizationId: ORG,
    productId: "prd-sw3",
    kind: "service_expansion",
    relatedEquipmentIds: [],
    relatedNeedIds: ["need-physio"],
    relatedServiceIds: ["svc-physio"],
    compatibilityTargets: [],
  },
  {
    id: "rec-04",
    organizationId: ORG,
    productId: "prd-link",
    kind: "emerging_solution",
    relatedEquipmentIds: [],
    relatedNeedIds: ["need-overview"],
    relatedServiceIds: [],
    compatibilityTargets: [
      { model: "VM-200", label: "monitorji vitalnih funkcij VM-200" },
      { model: "IP-3", label: "infuzijske črpalke IP-3" },
    ],
  },
];
