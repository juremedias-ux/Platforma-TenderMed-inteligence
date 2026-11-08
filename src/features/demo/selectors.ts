import type { DemoDataset } from "@/data/demo";
import {
  evaluatePlans,
  getEquipmentServiceStatus,
  getNextDueDate,
  type PlanWithStatus,
} from "@/features/equipment/maintenance";
import { compareIsoDates, type IsoDate } from "@/lib/dates/date-only";
import type {
  Equipment,
  EquipmentCategory,
  EquipmentServiceStatus,
  MaintenancePlan,
  RecommendationReviewState,
  ServiceRequest,
} from "@/types/domain";
import type { DemoState } from "./state";

/**
 * Derived views of the demo state. All counts shown anywhere in the demo
 * (including the homepage preview) come from these functions, so numbers
 * stay consistent with the underlying dataset.
 */

export interface DemoOverview {
  deviceCount: number;
  overdueActivities: number;
  upcomingActivities: number;
  openServiceRequests: number;
  recommendationsAwaitingReview: number;
}

export function computeOverview(
  dataset: Pick<DemoDataset, "equipment">,
  state: Pick<DemoState, "plans" | "serviceRequests" | "recommendationStates" | "referenceDate">,
): DemoOverview {
  const evaluated = evaluatePlans(state.plans, state.referenceDate);
  return {
    deviceCount: dataset.equipment.length,
    overdueActivities: evaluated.filter((p) => p.status === "overdue").length,
    upcomingActivities: evaluated.filter((p) => p.status === "due_soon").length,
    openServiceRequests: state.serviceRequests.filter((r) => r.status !== "closed").length,
    recommendationsAwaitingReview: Object.values(state.recommendationStates).filter((s) => s !== "dismissed").length,
  };
}

export interface EquipmentRow {
  equipment: Equipment;
  locationName: string;
  manufacturerName: string;
  status: EquipmentServiceStatus;
  nextDueDate: IsoDate | null;
  openRequestCount: number;
}

export function getEquipmentRows(dataset: DemoDataset, state: DemoState): EquipmentRow[] {
  return dataset.equipment.map((equipment) => {
    const plans = state.plans.filter((p) => p.equipmentId === equipment.id);
    return {
      equipment,
      locationName: dataset.locations.find((l) => l.id === equipment.locationId)?.name ?? "—",
      manufacturerName: dataset.manufacturers.find((m) => m.id === equipment.manufacturerId)?.name ?? "—",
      status: getEquipmentServiceStatus(plans, state.referenceDate),
      nextDueDate: getNextDueDate(plans),
      openRequestCount: state.serviceRequests.filter((r) => r.equipmentId === equipment.id && r.status !== "closed")
        .length,
    };
  });
}

export interface EquipmentFilters {
  query: string;
  category: EquipmentCategory | "all";
  locationId: string | "all";
  status: EquipmentServiceStatus | "all";
}

export const emptyEquipmentFilters: EquipmentFilters = {
  query: "",
  category: "all",
  locationId: "all",
  status: "all",
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("sl").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function filterEquipmentRows(rows: EquipmentRow[], filters: EquipmentFilters): EquipmentRow[] {
  const query = normalize(filters.query.trim());
  return rows.filter((row) => {
    if (filters.category !== "all" && row.equipment.category !== filters.category) return false;
    if (filters.locationId !== "all" && row.equipment.locationId !== filters.locationId) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (!query) return true;
    const haystack = normalize(
      [
        row.equipment.name,
        row.equipment.model,
        row.equipment.serialNumber,
        row.manufacturerName,
        row.locationName,
      ].join(" "),
    );
    return haystack.includes(query);
  });
}

export interface ActivityRow extends PlanWithStatus {
  equipment: Equipment;
  locationName: string;
}

/** Overdue and upcoming activities, earliest first. */
export function getAttentionActivities(dataset: DemoDataset, plans: MaintenancePlan[], referenceDate: IsoDate) {
  return evaluatePlans(plans, referenceDate)
    .filter((p) => p.status === "overdue" || p.status === "due_soon")
    .map((p) => {
      const equipment = dataset.equipment.find((e) => e.id === p.plan.equipmentId)!;
      return {
        ...p,
        equipment,
        locationName: dataset.locations.find((l) => l.id === equipment.locationId)?.name ?? "—",
      } satisfies ActivityRow;
    });
}

export function sortRequestsForDisplay(requests: ServiceRequest[]): ServiceRequest[] {
  return [...requests].sort((a, b) => {
    const aClosed = a.status === "closed" ? 1 : 0;
    const bClosed = b.status === "closed" ? 1 : 0;
    return aClosed - bClosed || compareIsoDates(b.createdOn, a.createdOn) || b.id.localeCompare(a.id);
  });
}

export function countByReviewState(states: Record<string, RecommendationReviewState>) {
  const values = Object.values(states);
  return {
    new: values.filter((s) => s === "new").length,
    saved: values.filter((s) => s === "saved").length,
    dismissed: values.filter((s) => s === "dismissed").length,
  };
}
