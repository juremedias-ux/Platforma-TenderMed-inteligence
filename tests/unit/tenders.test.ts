import { describe, expect, it } from "vitest";
import { buildDemoTenders, demoSupplierProfile } from "@/data/demo/tenders";
import { evaluateTender } from "@/features/tenders/rules";
import type { SupplierProfile, Tender } from "@/types/domain";

const tenders = buildDemoTenders("2026-11-08");
const byId = (id: string) => tenders.find((t) => t.id === id)!;

function statuses(tender: Tender, profile: SupplierProfile = demoSupplierProfile) {
  return Object.fromEntries(evaluateTender(tender, profile).requirements.map((r) => [r.requirementId, r.status]));
}

describe("illustrative tender matching", () => {
  it("distinguishes satisfied, missing evidence and human review", () => {
    const result = evaluateTender(byId("tn-01"), demoSupplierProfile);
    expect(statuses(byId("tn-01"))).toEqual({
      "tn-01-r1": "satisfied",
      "tn-01-r2": "satisfied",
      "tn-01-r3": "evidence_missing",
      "tn-01-r4": "satisfied",
      "tn-01-r5": "human_review_required",
    });
    expect(result.label).toBe("additional_review_required");
    expect(result.missingEvidence).toEqual(["Odzivni čas servisa največ 48 ur"]);
  });

  it("keeps missing evidence unresolved instead of treating it as satisfied", () => {
    const result = evaluateTender(byId("tn-03"), demoSupplierProfile);
    expect(statuses(byId("tn-03"))).toEqual({
      "tn-03-r1": "not_satisfied",
      "tn-03-r2": "evidence_missing",
      "tn-03-r3": "evidence_missing",
      "tn-03-r4": "evidence_missing",
    });
    expect(result.label).toBe("additional_review_required");
    expect(result.missingEvidence).toHaveLength(3);
  });

  it("labels a fully evidenced tender only as suitable for further review", () => {
    const result = evaluateTender(byId("tn-02"), demoSupplierProfile);
    expect(result.requirements.every((r) => r.status === "satisfied")).toBe(true);
    expect(result.label).toBe("suitable_for_further_review");
    expect(result.summary).toContain("Končno presojo izpolnjevanja pogojev opravi človek");
  });

  it("reports values that do not meet a limit as not satisfied", () => {
    const slowSupplier: SupplierProfile = {
      ...demoSupplierProfile,
      attributes: { ...demoSupplierProfile.attributes, deliveryDays: 45 },
    };
    expect(statuses(byId("tn-02"), slowSupplier)["tn-02-r2"]).toBe("not_satisfied");
  });

  it("never stores links to real procurement notices", () => {
    expect(tenders.every((t) => t.sourceUrl === null && t.isIllustrative)).toBe(true);
  });
});
