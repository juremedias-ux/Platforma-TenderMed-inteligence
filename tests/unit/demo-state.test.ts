import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/date-only";
import { createDemoDataset } from "@/data/demo";
import { getPlanStatus } from "@/features/equipment/maintenance";
import {
  computeOverview,
  emptyEquipmentFilters,
  filterEquipmentRows,
  getEquipmentRows,
} from "@/features/demo/selectors";
import { createInitialDemoState, demoReducer, type DemoState } from "@/features/demo/state";

const REFERENCE = "2026-11-08";
const dataset = createDemoDataset(REFERENCE);
const candidates = dataset.recommendationCandidates.map((c) => ({ candidateId: c.id })) as never[];

function initial(): DemoState {
  return createInitialDemoState(dataset, candidates);
}

function createRequest(state: DemoState, proposed: string | null = addDays(REFERENCE, 7)) {
  const next = demoReducer(state, {
    type: "create_service_request",
    equipmentId: "eq-09",
    issueCategory: "scheduled_maintenance",
    urgency: "normal",
    proposedAppointment: proposed,
    replacementEquipmentRequested: true,
  });
  return { state: next, request: next.serviceRequests[0]! };
}

describe("demo service requests", () => {
  it("creates a request with structured fields and a timeline", () => {
    const { state, request } = createRequest(initial());
    expect(request).toMatchObject({
      equipmentId: "eq-09",
      status: "new",
      proposedAppointment: addDays(REFERENCE, 7),
      confirmedAppointment: null,
      replacementEquipmentRequested: true,
      completionEventId: null,
    });
    expect(request.timeline.map((e) => e.kind)).toEqual(["created", "appointment_proposed"]);
    expect(computeOverview(dataset, state).openServiceRequests).toBe(4);
  });

  it("rejects proposed dates in the past", () => {
    const state = initial();
    const { state: next } = createRequest(state, addDays(REFERENCE, -1));
    expect(next).toBe(state);
  });

  it("distinguishes proposing a date from confirming it", () => {
    let { state, request } = createRequest(initial());
    state = demoReducer(state, { type: "change_status", requestId: request.id, status: "appointment_confirmed" });
    expect(state.serviceRequests[0]!.status).toBe("new"); // blocked: nothing confirmed yet

    state = demoReducer(state, { type: "confirm_appointment", requestId: request.id });
    request = state.serviceRequests[0]!;
    expect(request.status).toBe("appointment_confirmed");
    expect(request.confirmedAppointment).toBe(addDays(REFERENCE, 7));

    state = demoReducer(state, { type: "propose_appointment", requestId: request.id, date: addDays(REFERENCE, 10) });
    request = state.serviceRequests[0]!;
    expect(request.proposedAppointment).toBe(addDays(REFERENCE, 10));
    expect(request.confirmedAppointment).toBeNull();
    expect(request.status).toBe("coordinating");
  });

  it("does not record maintenance as completed when the request is closed", () => {
    let { state, request } = createRequest(initial());
    state = demoReducer(state, { type: "change_status", requestId: request.id, status: "closed" });
    request = state.serviceRequests[0]!;
    expect(request.status).toBe("closed");
    expect(request.completionEventId).toBeNull();
    const plan = state.plans.find((p) => p.id === "pl-09-cal")!;
    expect(getPlanStatus(plan, REFERENCE)).toBe("overdue");
    expect(state.serviceEvents).toHaveLength(dataset.serviceEvents.length);
  });

  it("records completion as a separate explicit action with a date and service record", () => {
    let { state, request } = createRequest(initial());
    const before = computeOverview(dataset, state);
    state = demoReducer(state, {
      type: "record_completion",
      requestId: request.id,
      completionDate: REFERENCE,
      planIds: ["pl-09-cal"],
      includesRepair: false,
    });
    request = state.serviceRequests[0]!;
    expect(request.completionEventId).not.toBeNull();
    expect(request.status).toBe("new"); // status unchanged by completion
    const event = state.serviceEvents.find((e) => e.id === request.completionEventId)!;
    expect(event).toMatchObject({ date: REFERENCE, types: ["calibration"], createdInDemoSession: true, costEur: null });
    const plan = state.plans.find((p) => p.id === "pl-09-cal")!;
    expect(getPlanStatus(plan, REFERENCE)).toBe("scheduled");
    expect(computeOverview(dataset, state).overdueActivities).toBe(before.overdueActivities - 1);
  });

  it("rejects completion dates in the future, before the request, or without activities", () => {
    const { state, request } = createRequest(initial());
    const base = { type: "record_completion" as const, requestId: request.id, includesRepair: false };
    expect(demoReducer(state, { ...base, completionDate: addDays(REFERENCE, 1), planIds: ["pl-09-cal"] })).toBe(state);
    expect(demoReducer(state, { ...base, completionDate: addDays(REFERENCE, -1), planIds: ["pl-09-cal"] })).toBe(state);
    expect(demoReducer(state, { ...base, completionDate: REFERENCE, planIds: [] })).toBe(state);
    // Plans of other devices are ignored.
    expect(demoReducer(state, { ...base, completionDate: REFERENCE, planIds: ["pl-01-insp"] })).toBe(state);
  });

  it("resets to the initial state", () => {
    const start = initial();
    let { state } = createRequest(start);
    state = demoReducer(state, { type: "set_recommendation_state", candidateId: "rec-01", state: "dismissed" });
    expect(computeOverview(dataset, state).recommendationsAwaitingReview).toBe(3);
    state = demoReducer(state, { type: "reset", initialState: start });
    expect(state).toEqual(start);
    expect(computeOverview(dataset, state).openServiceRequests).toBe(3);
  });
});

describe("demo equipment filtering", () => {
  const rows = getEquipmentRows(dataset, initial());

  it("returns all devices without filters", () => {
    expect(filterEquipmentRows(rows, emptyEquipmentFilters)).toHaveLength(12);
  });

  it("filters by search text ignoring case and diacritics", () => {
    const result = filterEquipmentRows(rows, { ...emptyEquipmentFilters, query: "crpalka" });
    expect(result.map((r) => r.equipment.id)).toEqual(["eq-03", "eq-04"]);
    expect(filterEquipmentRows(rows, { ...emptyEquipmentFilters, query: "VM2-24" })).toHaveLength(1);
  });

  it("filters by category, location and service status", () => {
    expect(
      filterEquipmentRows(rows, { ...emptyEquipmentFilters, category: "physiotherapy" }).map((r) => r.equipment.id),
    ).toEqual(["eq-08", "eq-09"]);
    expect(
      filterEquipmentRows(rows, { ...emptyEquipmentFilters, locationId: "loc-er" }).map((r) => r.equipment.id),
    ).toEqual(["eq-01", "eq-04", "eq-05", "eq-12"]);
    expect(
      filterEquipmentRows(rows, { ...emptyEquipmentFilters, status: "overdue" }).map((r) => r.equipment.id),
    ).toEqual(["eq-03", "eq-05", "eq-09"]);
    expect(
      filterEquipmentRows(rows, { ...emptyEquipmentFilters, status: "overdue", locationId: "loc-physio" }).map(
        (r) => r.equipment.id,
      ),
    ).toEqual(["eq-09"]);
  });
});
