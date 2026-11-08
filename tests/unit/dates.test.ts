import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  diffInDays,
  fullYearsBetween,
  isLeapYear,
  isoDateInTimeZone,
  isValidIsoDate,
} from "@/lib/dates/date-only";
import { daysAccusative, describeDeadline, formatDate, formatLongDate } from "@/lib/dates/format";
import { getDemoReferenceDate } from "@/lib/dates/reference-date";
import { getPlanDueDate, getPlanStatus } from "@/features/equipment/maintenance";
import type { MaintenancePlan } from "@/types/domain";

describe("leap years and month lengths", () => {
  it("applies Gregorian leap-year rules", () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2027)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2027, 4)).toBe(30);
  });

  it("validates ISO dates including 29 February", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("2027-13-01")).toBe(false);
    expect(isValidIsoDate("8. 11. 2026")).toBe(false);
  });
});

describe("addMonths month-end policy (clamp to last day of month)", () => {
  it.each([
    ["2027-01-31", 1, "2027-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2028-02-29", 12, "2029-02-28"],
    ["2028-02-29", 48, "2032-02-29"],
    ["2027-08-31", 6, "2028-02-29"],
    ["2026-10-31", 1, "2026-11-30"],
    ["2026-12-15", 1, "2027-01-15"],
    ["2026-03-31", -1, "2026-02-28"],
    ["2027-11-30", 3, "2028-02-29"],
  ])("%s + %i months = %s", (start, months, expected) => {
    expect(addMonths(start, months)).toBe(expected);
  });

  it("does not drift when intervals are recalculated from the last completion", () => {
    // Completed 31 January; a 1-month interval is due 28 February.
    const plan: MaintenancePlan = {
      id: "p",
      organizationId: "o",
      equipmentId: "e",
      activityType: "calibration",
      schedule: { kind: "interval", intervalMonths: 1, lastCompletedDate: "2027-01-31" },
      source: { basis: "manufacturer_instructions" },
      responsibleRole: "Tehnična služba",
    };
    expect(getPlanDueDate(plan)).toBe("2027-02-28");
    // Completing on 31 March again yields 30 April, not 28 April.
    expect(getPlanDueDate({ ...plan, schedule: { ...plan.schedule, lastCompletedDate: "2027-03-31" } })).toBe(
      "2027-04-30",
    );
  });
});

describe("day arithmetic across month, year and DST boundaries", () => {
  it("adds days across month and year transitions", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is not affected by daylight-saving changes", () => {
    // Europe/Ljubljana switches to summer time on 29 March 2026.
    expect(diffInDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffInDays("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("counts completed years", () => {
    expect(fullYearsBetween("2018-11-09", "2026-11-08")).toBe(7);
    expect(fullYearsBetween("2018-11-08", "2026-11-08")).toBe(8);
    expect(fullYearsBetween("2024-02-29", "2025-02-28")).toBe(0);
  });
});

describe("Europe/Ljubljana reference date", () => {
  it("uses the local calendar date, not the UTC date", () => {
    // 23:30 UTC on 31 December is already 1 January in Ljubljana (UTC+1).
    expect(isoDateInTimeZone(new Date("2026-12-31T23:30:00Z"), "Europe/Ljubljana")).toBe("2027-01-01");
    // 22:30 UTC on 30 June is 00:30 on 1 July in summer time (UTC+2).
    expect(isoDateInTimeZone(new Date("2026-06-30T22:30:00Z"), "Europe/Ljubljana")).toBe("2026-07-01");
  });

  it("can be pinned through DEMO_REFERENCE_DATE and ignores invalid values", ({ onTestFinished }) => {
    const previous = process.env.DEMO_REFERENCE_DATE;
    onTestFinished(() => {
      if (previous === undefined) delete process.env.DEMO_REFERENCE_DATE;
      else process.env.DEMO_REFERENCE_DATE = previous;
    });
    process.env.DEMO_REFERENCE_DATE = "2028-02-29";
    expect(getDemoReferenceDate()).toBe("2028-02-29");
    process.env.DEMO_REFERENCE_DATE = "2027-02-29";
    expect(getDemoReferenceDate(new Date("2026-05-05T10:00:00Z"))).toBe("2026-05-05");
  });
});

describe("Slovenian formatting", () => {
  it("formats dates in Slovenian", () => {
    expect(formatDate("2026-11-08")).toBe("8. 11. 2026");
    expect(formatLongDate("2028-02-29")).toBe("29. februar 2028");
  });

  it("uses the correct accusative forms of 'dan'", () => {
    expect([1, 2, 3, 4, 5, 11, 21, 101, 102].map(daysAccusative)).toEqual([
      "dan",
      "dneva",
      "dni",
      "dni",
      "dni",
      "dni",
      "dni",
      "dan",
      "dneva",
    ]);
    expect(describeDeadline("2026-11-10", "2026-11-08")).toBe("čez 2 dneva");
    expect(describeDeadline("2026-11-07", "2026-11-08")).toBe("zamuja 1 dan");
    expect(describeDeadline("2026-11-08", "2026-11-08")).toBe("rok je danes");
  });
});

describe("maintenance status thresholds", () => {
  const plan = (dueDate: string | null): MaintenancePlan => ({
    id: "p",
    organizationId: "o",
    equipmentId: "e",
    activityType: "inspection",
    schedule: { kind: "manual", dueDate, lastCompletedDate: null },
    source: { basis: "service_contract" },
    responsibleRole: "Tehnična služba",
  });

  it("classifies due dates relative to the reference date", () => {
    expect(getPlanStatus(plan("2026-11-07"), "2026-11-08")).toBe("overdue");
    expect(getPlanStatus(plan("2026-11-08"), "2026-11-08")).toBe("due_soon");
    expect(getPlanStatus(plan("2026-12-08"), "2026-11-08")).toBe("due_soon");
    expect(getPlanStatus(plan("2026-12-09"), "2026-11-08")).toBe("scheduled");
    expect(getPlanStatus(plan(null), "2026-11-08")).toBe("no_due_date");
  });
});
