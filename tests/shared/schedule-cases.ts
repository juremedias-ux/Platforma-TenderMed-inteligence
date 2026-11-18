import type { PlanSchedule } from "@/lib/maintenance/schedule";

/**
 * Scheduling cases shared by the unit tests (TypeScript) and the database
 * tests (private.compute_next_due) to keep both implementations identical.
 */
export interface ScheduleCase {
  name: string;
  plan: PlanSchedule;
  completions: string[];
  expected: string | null;
}

const fixed = (anchorDate: string, intervalMonths: number): PlanSchedule => ({
  mode: "fixed_calendar",
  intervalMonths,
  anchorDate,
  dueDate: null,
});
const after = (anchorDate: string, intervalMonths: number): PlanSchedule => ({
  mode: "after_completion",
  intervalMonths,
  anchorDate,
  dueDate: null,
});
const once = (dueDate: string): PlanSchedule => ({ mode: "one_off", intervalMonths: null, anchorDate: null, dueDate });

export const scheduleCases: ScheduleCase[] = [
  { name: "fixed: no completion → anchor", plan: fixed("2026-01-15", 12), completions: [], expected: "2026-01-15" },
  {
    name: "fixed: on-time completion → next calendar date",
    plan: fixed("2026-01-15", 12),
    completions: ["2026-01-10"],
    expected: "2027-01-15",
  },
  {
    name: "fixed: late completion keeps the calendar (no drift)",
    plan: fixed("2026-01-15", 12),
    completions: ["2026-03-20"],
    expected: "2027-01-15",
  },
  {
    name: "fixed: very late completion skips missed dates",
    plan: fixed("2026-01-15", 6),
    completions: ["2027-02-01"],
    expected: "2027-07-15",
  },
  {
    name: "fixed: completion on a due date covers it",
    plan: fixed("2026-01-15", 6),
    completions: ["2026-07-15"],
    expected: "2027-01-15",
  },
  {
    name: "fixed: month-end anchor is clamped per date, never chained",
    plan: fixed("2026-01-31", 1),
    completions: ["2026-01-30", "2026-02-27"],
    expected: "2026-03-31",
  },
  {
    name: "fixed: leap day anchor",
    plan: fixed("2028-02-29", 12),
    completions: ["2028-02-20"],
    expected: "2029-02-28",
  },
  {
    name: "fixed: unordered completions are sorted",
    plan: fixed("2026-01-15", 12),
    completions: ["2027-01-10", "2026-01-10"],
    expected: "2028-01-15",
  },
  { name: "after: no completion → anchor", plan: after("2026-05-01", 6), completions: [], expected: "2026-05-01" },
  {
    name: "after: interval from last completion",
    plan: after("2026-05-01", 6),
    completions: ["2026-04-10", "2026-08-31"],
    expected: "2027-02-28",
  },
  { name: "one-off: open", plan: once("2026-12-01"), completions: [], expected: "2026-12-01" },
  { name: "one-off: done", plan: once("2026-12-01"), completions: ["2026-11-20"], expected: null },
];
