import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/date-only";
import { createDemoDataset } from "@/data/demo";
import { loadDemoSnapshot } from "@/features/demo/snapshot";
import { computeOverview, getEquipmentRows } from "@/features/demo/selectors";
import { createInitialDemoState } from "@/features/demo/state";

const EXPECTED_OVERVIEW = {
  deviceCount: 12,
  overdueActivities: 3,
  upcomingActivities: 4,
  openServiceRequests: 3,
  recommendationsAwaitingReview: 4,
};

describe("time-relative demo dataset", () => {
  it("produces the documented overview counts", async () => {
    const snapshot = await loadDemoSnapshot("2026-11-08");
    const state = createInitialDemoState(snapshot.dataset, snapshot.recommendations);
    expect(computeOverview(snapshot.dataset, state)).toEqual(EXPECTED_OVERVIEW);
  });

  it("keeps the same statuses for every reference date across two years, including leap days", async () => {
    let reference = "2027-01-01";
    for (let i = 0; i < 800; i += 1) {
      const snapshot = await loadDemoSnapshot(reference);
      const state = createInitialDemoState(snapshot.dataset, snapshot.recommendations);
      const overview = computeOverview(snapshot.dataset, state);
      expect(overview, `reference date ${reference}`).toEqual(EXPECTED_OVERVIEW);
      const labels = snapshot.recommendations.map((r) => `${r.candidateId}:${r.reviewLabel}`).sort();
      expect(labels, `reference date ${reference}`).toEqual([
        "rec-01:worth_review",
        "rec-02:compatibility_check_needed",
        "rec-03:worth_review",
        "rec-04:insufficient_data",
      ]);
      reference = addDays(reference, 1);
    }
  });

  it("assigns each equipment status at least once and keeps one device without a schedule", () => {
    const dataset = createDemoDataset("2028-02-29");
    const state = createInitialDemoState(dataset, []);
    const statuses = getEquipmentRows(dataset, state).map((r) => r.status);
    expect(new Set(statuses)).toEqual(new Set(["overdue", "due_soon", "ok", "not_scheduled"]));
    expect(statuses.filter((s) => s === "not_scheduled")).toHaveLength(1);
  });

  it("references only existing records", () => {
    const dataset = createDemoDataset("2026-11-08");
    const equipmentIds = new Set(dataset.equipment.map((e) => e.id));
    const documentIds = new Set(dataset.documents.map((d) => d.id));
    for (const plan of dataset.plans) {
      expect(equipmentIds.has(plan.equipmentId)).toBe(true);
      if (plan.source.documentId) expect(documentIds.has(plan.source.documentId)).toBe(true);
    }
    for (const event of dataset.serviceEvents) {
      expect(equipmentIds.has(event.equipmentId)).toBe(true);
      event.documentIds.forEach((id) => expect(documentIds.has(id)).toBe(true));
    }
    for (const request of dataset.serviceRequests) {
      expect(equipmentIds.has(request.equipmentId)).toBe(true);
    }
    for (const product of dataset.products) {
      product.documentIds.forEach((id) => expect(documentIds.has(id)).toBe(true));
    }
    expect(dataset.documents.every((d) => d.fileStored === false)).toBe(true);
  });

  it("marks every organization, manufacturer, product and tender as fictional or illustrative", () => {
    const dataset = createDemoDataset("2026-11-08");
    expect(dataset.organization.isFictional).toBe(true);
    expect(dataset.partners.every((p) => p.isFictional)).toBe(true);
    expect(dataset.manufacturers.every((m) => m.isFictional)).toBe(true);
    expect(dataset.products.every((p) => p.isFictional)).toBe(true);
    expect(dataset.tenders.every((t) => t.isIllustrative && t.sourceUrl === null)).toBe(true);
  });
});
