import { addMonths, compareIsoDates, diffInDays, type IsoDate } from "@/lib/dates/date-only";
import type { EquipmentServiceStatus, MaintenancePlan, MaintenanceStatus } from "@/types/domain";

/** Activities due within this many days (inclusive) count as "upcoming". */
export const DUE_SOON_WINDOW_DAYS = 30;

/**
 * Next due date of a maintenance plan.
 *
 * Interval plans: last recorded completion + interval (month-end clamped).
 * Manual plans: the manually entered due date, or null when none is set.
 * Intervals are inputs from manufacturer instructions, procedures or
 * contracts — they are never estimated by the platform.
 */
export function getPlanDueDate(plan: MaintenancePlan): IsoDate | null {
  if (plan.schedule.kind === "interval") {
    return addMonths(plan.schedule.lastCompletedDate, plan.schedule.intervalMonths);
  }
  return plan.schedule.dueDate;
}

export function getPlanStatus(plan: MaintenancePlan, referenceDate: IsoDate): MaintenanceStatus {
  const due = getPlanDueDate(plan);
  if (!due) return "no_due_date";
  const days = diffInDays(referenceDate, due);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_WINDOW_DAYS) return "due_soon";
  return "scheduled";
}

export interface PlanWithStatus {
  plan: MaintenancePlan;
  dueDate: IsoDate | null;
  status: MaintenanceStatus;
}

export function evaluatePlans(plans: MaintenancePlan[], referenceDate: IsoDate): PlanWithStatus[] {
  return plans
    .map((plan) => ({ plan, dueDate: getPlanDueDate(plan), status: getPlanStatus(plan, referenceDate) }))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return compareIsoDates(a.dueDate, b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.plan.id.localeCompare(b.plan.id);
    });
}

/** Worst status across a device's plans. Devices without any dated plan are "not_scheduled". */
export function getEquipmentServiceStatus(plans: MaintenancePlan[], referenceDate: IsoDate): EquipmentServiceStatus {
  const statuses = plans.map((plan) => getPlanStatus(plan, referenceDate));
  if (statuses.includes("overdue")) return "overdue";
  if (statuses.includes("due_soon")) return "due_soon";
  if (statuses.includes("scheduled")) return "ok";
  return "not_scheduled";
}

/** Earliest upcoming or overdue due date for a device. */
export function getNextDueDate(plans: MaintenancePlan[]): IsoDate | null {
  const dates = plans.map(getPlanDueDate).filter((d): d is IsoDate => d !== null);
  if (dates.length === 0) return null;
  return dates.sort(compareIsoDates)[0] ?? null;
}

/**
 * Applies a recorded completion to a plan. Interval plans restart from the
 * completion date; manual plans keep the completion and clear the due date,
 * because the next date must be entered explicitly.
 */
export function applyCompletionToPlan(plan: MaintenancePlan, completionDate: IsoDate): MaintenancePlan {
  if (plan.schedule.kind === "interval") {
    return { ...plan, schedule: { ...plan.schedule, lastCompletedDate: completionDate } };
  }
  return { ...plan, schedule: { kind: "manual", dueDate: null, lastCompletedDate: completionDate } };
}
