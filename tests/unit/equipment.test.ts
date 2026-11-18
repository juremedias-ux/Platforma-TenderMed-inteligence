import { describe, expect, it } from "vitest";
import { neutralizeFormula, parseCsv, restoreNeutralized, toCsv } from "@/lib/csv/csv";
import {
  equipmentCsvTemplate,
  equipmentToCsv,
  MAX_IMPORT_ROWS,
  parseImportDate,
  validateEquipmentCsv,
} from "@/lib/equipment/csv-format";
import { computeNextDue, countMonths, dueState, explainSchedule } from "@/lib/maintenance/schedule";
import { planSchema, reminderDaysSchema } from "@/lib/validation/equipment-schemas";
import { scheduleCases } from "../shared/schedule-cases";

const none = { assetTags: new Set<string>(), serials: new Set<string>() };

describe("maintenance scheduling", () => {
  it.each(scheduleCases)("$name", ({ plan, completions, expected }) => {
    expect(computeNextDue(plan, completions)).toBe(expected);
  });

  it("classifies due states relative to today", () => {
    expect(dueState("2026-11-09", "2026-11-10")).toBe("overdue");
    expect(dueState("2026-11-10", "2026-11-10")).toBe("due_soon");
    expect(dueState("2026-12-10", "2026-11-10")).toBe("due_soon");
    expect(dueState("2026-12-11", "2026-11-10")).toBe("scheduled");
    expect(dueState(null, "2026-11-10")).toBe("done");
    expect(dueState("2026-11-09", "2026-11-10", true)).toBe("archived");
  });

  it("explains schedules in Slovenian", () => {
    expect(countMonths(1)).toBe("1 mesec");
    expect(countMonths(2)).toBe("2 meseca");
    expect(countMonths(3)).toBe("3 mesece");
    expect(countMonths(12)).toBe("12 mesecev");
    expect(
      explainSchedule({
        mode: "after_completion",
        intervalMonths: 6,
        anchorDate: "2026-01-01",
        dueDate: null,
        lastCompletedOn: "2026-02-01",
      }),
    ).toBe("Naslednji rok je 6 mesecev po zadnji potrjeni izvedbi.");
  });
});

describe("plan form validation", () => {
  const base = {
    activityType: "inspection",
    activityLabel: "",
    scheduleMode: "fixed_calendar",
    intervalMonths: "12",
    anchorDate: "2026-01-15",
    dueDate: "",
    responsibleUserId: "",
    reminderDays: "30, 7",
    sourceBasis: "manufacturer_instructions",
    sourceNote: "",
  };

  it("accepts a recurring plan and normalizes reminder days", () => {
    const parsed = planSchema.parse(base);
    expect(parsed).toMatchObject({
      intervalMonths: 12,
      anchorDate: "2026-01-15",
      dueDate: null,
      reminderDays: [30, 7],
    });
  });

  it("requires interval and anchor for recurring plans and a due date for one-off plans", () => {
    const recurring = planSchema.safeParse({ ...base, intervalMonths: "0", anchorDate: "" });
    expect(recurring.success).toBe(false);
    expect(recurring.error?.issues.map((i) => i.path[0]).sort()).toEqual(["anchorDate", "intervalMonths"]);
    const oneOff = planSchema.safeParse({ ...base, scheduleMode: "one_off", dueDate: "2026-02-30" });
    expect(oneOff.error?.issues.map((i) => i.path[0])).toEqual(["dueDate"]);
    expect(planSchema.parse({ ...base, scheduleMode: "one_off", dueDate: "2026-12-01" })).toMatchObject({
      intervalMonths: null,
      anchorDate: null,
      dueDate: "2026-12-01",
    });
  });

  it("requires a label for 'other' activities", () => {
    expect(planSchema.safeParse({ ...base, activityType: "other" }).success).toBe(false);
  });

  it("validates reminder days", () => {
    expect(reminderDaysSchema.parse("")).toEqual([]);
    expect(reminderDaysSchema.parse("7;30 30")).toEqual([30, 7]);
    expect(reminderDaysSchema.safeParse("400").success).toBe(false);
    expect(reminderDaysSchema.safeParse("1,2,3,4,5,6").success).toBe(false);
    expect(reminderDaysSchema.safeParse("-1").success).toBe(false);
  });
});

describe("CSV", () => {
  it("parses quoted fields, embedded delimiters, quotes and line breaks", () => {
    const { rows, delimiter } = parseCsv('﻿a;b;c\r\n"x;y";"he said ""hi""";"line1\nline2"\r\n\r\n');
    expect(delimiter).toBe(";");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x;y", 'he said "hi"', "line1\nline2"],
    ]);
  });

  it("detects comma-separated files", () => {
    expect(parseCsv("a,b\n1,2").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rejects unterminated quotes", () => {
    expect(() => parseCsv('a;b\n"x;1')).toThrow(/narekovaj/);
  });

  it("neutralizes formula-like cells on export and restores them on import", () => {
    for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
      expect(restoreNeutralized(neutralizeFormula(value))).toBe(value);
    }
    expect(neutralizeFormula("Monitor")).toBe("Monitor");
    const csv = toCsv([['=HYPERLINK("http://x")', "a;b"]]);
    expect(csv).toBe('﻿"\'=HYPERLINK(""http://x"")";"a;b"\r\n');
  });
});

describe("equipment CSV import", () => {
  const header = "naziv;kategorija;inventarna_stevilka;proizvajalec;serijska_stevilka;lokacija;datum_nakupa;status";

  it("accepts codes or Slovenian labels and both date formats", () => {
    const result = validateEquipmentCsv(
      `${header}\nMonitor A;Monitorji vitalnih funkcij;INV-1;Acme;SN1;Urgenca;15. 3. 2024;Na servisu\nČrpalka;infusion;;;;;2024-01-02;`,
      none,
    );
    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      name: "Monitor A",
      category: "patient_monitoring",
      asset_tag: "INV-1",
      purchase_date: "2024-03-15",
      status: "in_service",
      location: "Urgenca",
    });
    expect(result.rows[1]).toMatchObject({ category: "infusion", status: "active", asset_tag: null, location: null });
  });

  it("reports row errors and imports nothing when any row is invalid", () => {
    const result = validateEquipmentCsv(
      `${header}\nMonitor;neznano;INV-1;;;;;\nX;ecg;INV-1;;;;31.2.2024;arhivirano\nOK naprava;ecg;inv-1;;;;;`,
      none,
    );
    expect(result.rows).toEqual([]);
    const messages = result.issues.map((i) => `${i.line}:${i.column}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        "2:kategorija",
        "3:naziv",
        "3:datum_nakupa",
        "3:status",
        "3:inventarna_stevilka",
        "4:inventarna_stevilka",
      ]),
    );
  });

  it("rejects duplicates of existing records", () => {
    const result = validateEquipmentCsv(`${header}\nMonitor;ecg;INV-9;Acme;SN-1;;;`, {
      assetTags: new Set(["inv-9"]),
      serials: new Set(["acme|sn-1"]),
    });
    expect(result.issues.map((i) => i.column)).toEqual(["inventarna_stevilka", "serijska_stevilka"]);
  });

  it("enforces the fixed format and limits", () => {
    expect(validateEquipmentCsv("naziv;neznan\nA;B", none).issues[0]?.message).toMatch(/Neznan stolpec/);
    expect(validateEquipmentCsv("naziv\nMonitor", none).issues[0]).toMatchObject({ column: "kategorija" });
    expect(validateEquipmentCsv("naziv;kategorija\n", none).issues[0]?.message).toMatch(/nima vrstic/);
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Naprava ${i};ecg`).join("\n");
    expect(validateEquipmentCsv(`naziv;kategorija\n${many}`, none).issues[0]?.message).toMatch(/največ 500/);
  });

  it("round-trips an export, including neutralized formulas", () => {
    const csv = equipmentToCsv([
      {
        asset_tag: "=CMD",
        name: 'Monitor; oddelek "A"',
        category: "patient_monitoring",
        manufacturer_name: null,
        model: null,
        serial_number: null,
        location_name: "Urgenca",
        purchase_date: "2024-01-01",
        commissioning_date: null,
        warranty_end_date: null,
        status: "active",
        notes: "vrstica 1\nvrstica 2",
        next_due_date: "2026-12-01",
      },
    ]);
    const result = validateEquipmentCsv(csv, none);
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ asset_tag: "=CMD", name: 'Monitor; oddelek "A"', location: "Urgenca" });
  });

  it("provides a header-only template", () => {
    expect(parseCsv(equipmentCsvTemplate()).rows).toHaveLength(1);
  });

  it("parses Slovenian and ISO dates strictly", () => {
    expect(parseImportDate("1.2.2026")).toBe("2026-02-01");
    expect(parseImportDate("2026-02-01")).toBe("2026-02-01");
    expect(parseImportDate("29. 2. 2025")).toBeNull();
    expect(parseImportDate("02/01/2026")).toBeNull();
  });
});
