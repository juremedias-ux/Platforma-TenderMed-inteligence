import { addMonths, diffInDays, type IsoDate } from "@/lib/dates/date-only";
import type { ScheduleMode } from "@/lib/equipment/domain";
import { pluralSl } from "@/lib/utils/plural";

/**
 * Maintenance scheduling. This is the TypeScript twin of
 * private.compute_next_due() in supabase/migrations/20261110120100_equipment.sql;
 * tests/db/equipment.test.ts checks that both return the same dates.
 *
 *   fixed_calendar   due dates are anchor + k × interval, each computed from
 *                    the anchor (month-end clamped, never chained). Every
 *                    qualifying completion covers the earliest outstanding due
 *                    date; due dates on or before a completion are skipped,
 *                    so missed periods do not pile up.
 *   after_completion next due = last completion + interval; before the first
 *                    completion the anchor date is the first due date.
 *   one_off          one due date; no further due date after a completion.
 *
 * `completions` are the dates of confirmed, non-voided completions in any
 * order.
 */
export interface PlanSchedule {
  mode: ScheduleMode;
  intervalMonths: number | null;
  anchorDate: IsoDate | null;
  dueDate: IsoDate | null;
}

export function computeNextDue(plan: PlanSchedule, completions: readonly IsoDate[]): IsoDate | null {
  const done = [...completions].sort();
  if (plan.mode === "one_off") return done.length > 0 ? null : plan.dueDate;

  const interval = plan.intervalMonths;
  const anchor = plan.anchorDate;
  if (!interval || !anchor) return null;

  if (plan.mode === "after_completion") {
    const last = done.at(-1);
    return last ? addMonths(last, interval) : anchor;
  }

  let k = 0;
  let next = anchor;
  for (const completion of done) {
    k += 1;
    next = addMonths(anchor, k * interval);
    while (next <= completion) {
      k += 1;
      next = addMonths(anchor, k * interval);
    }
  }
  return next;
}

export type DueState = "overdue" | "due_soon" | "scheduled" | "done" | "archived";

export const dueStateLabels: Record<DueState, string> = {
  overdue: "Rok je potekel",
  due_soon: "Prihaja v 30 dneh",
  scheduled: "Načrtovano",
  done: "Opravljeno",
  archived: "Arhivirano",
};

export const DUE_SOON_DAYS = 30;

export function dueState(nextDue: IsoDate | null, today: IsoDate, archived = false): DueState {
  if (archived) return "archived";
  if (!nextDue) return "done";
  const days = diffInDays(today, nextDue);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due_soon";
  return "scheduled";
}

/** Slovenian sentence explaining how the next due date was derived. */
export function explainSchedule(plan: PlanSchedule & { lastCompletedOn: IsoDate | null }): string {
  const interval = countMonths(plan.intervalMonths ?? 0);
  switch (plan.mode) {
    case "one_off":
      return plan.lastCompletedOn ? "Enkratna aktivnost je opravljena." : "Enkratna aktivnost z določenim rokom.";
    case "after_completion":
      return plan.lastCompletedOn
        ? `Naslednji rok je ${interval} po zadnji potrjeni izvedbi.`
        : `Pred prvo izvedbo velja začetni rok, nato ${interval} po vsaki izvedbi.`;
    case "fixed_calendar":
      return `Roki so na koledarju od začetnega datuma, interval je ${interval}; izvedba pokrije najzgodnejši odprt rok.`;
  }
}

/** "1 mesec", "2 meseca", "3 mesece", "5 mesecev". */
export function countMonths(n: number): string {
  return `${n} ${pluralSl(n, ["mesec", "meseca", "mesece", "mesecev"])}`;
}
