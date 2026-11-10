import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTimeRange } from "@/lib/dates/datetime";
import { availableTransitions, describeEvent, replacementTransitions } from "@/lib/service/domain";
import { appointmentSchema, completionSchema, messageSchema, reasonSchema } from "@/lib/validation/service-schemas";

afterEach(() => {
  vi.useRealTimers();
});

describe("service request transitions (UI mirror of the database rules)", () => {
  it("offers nothing on closed requests or to viewers", () => {
    expect(availableTransitions("zakljuceno", "operator")).toEqual([]);
    expect(availableTransitions("preklicano", "operator")).toEqual([]);
    expect(availableTransitions("v_izvedbi", "viewer")).toEqual([]);
  });

  it("lets only operators cancel and close", () => {
    expect(availableTransitions("v_izvedbi", "operator")).toEqual(["v_usklajevanju", "zakljuceno", "preklicano"]);
    expect(availableTransitions("v_izvedbi", "assignee")).toEqual(["v_usklajevanju"]);
    expect(availableTransitions("termin_potrjen", "assignee")).toEqual(["v_izvedbi", "v_usklajevanju"]);
    expect(availableTransitions("novo", "assignee")).toEqual([]);
    expect(availableTransitions("novo", "operator")).toEqual(["v_usklajevanju", "preklicano"]);
    expect(availableTransitions("caka_na_potrditev", "operator")).toEqual(["zakljuceno", "preklicano"]);
  });

  it("allows replacement equipment to move forward only", () => {
    expect(replacementTransitions.delivered).toEqual(["returned"]);
    expect(replacementTransitions.returned).toEqual([]);
  });

  it("describes timeline events in Slovenian", () => {
    expect(describeEvent("status_changed", "novo", "v_usklajevanju")).toBe("Status: Novo → V usklajevanju");
    expect(describeEvent("replacement_changed", "requested", "arranged")).toBe(
      "Nadomestna oprema: Zahtevana → Dogovorjena",
    );
  });
});

describe("appointment input", () => {
  it("converts Ljubljana wall time to UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T08:00:00Z"));
    const parsed = appointmentSchema.parse({ date: "2026-11-12", startTime: "09:00", endTime: "11:30", note: "" });
    expect(parsed).toEqual({ starts: "2026-11-12T08:00:00.000Z", ends: "2026-11-12T10:30:00.000Z", note: null });
    expect(formatDateTimeRange(parsed.starts, parsed.ends)).toMatch(/12\. 11\. 2026.*09:00–11:30/);
  });

  it("rejects past times, reversed ranges and non-existent DST times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-01T08:00:00Z"));
    const paths = (input: Record<string, string>) =>
      appointmentSchema.safeParse({ note: "", ...input }).error?.issues.map((i) => i.path[0]);
    expect(paths({ date: "2027-02-01", startTime: "09:00", endTime: "10:00" })).toEqual(["date"]);
    expect(paths({ date: "2027-03-10", startTime: "11:00", endTime: "10:00" })).toEqual(["endTime"]);
    // 28 March 2027: clocks jump from 02:00 to 03:00 in Ljubljana.
    expect(paths({ date: "2027-03-28", startTime: "02:30", endTime: "04:00" })).toEqual(["startTime"]);
  });
});

describe("completion and message input", () => {
  it("validates completion records", () => {
    expect(
      completionSchema.safeParse({ completedOn: "2026-11-01", outcome: "completed", summary: "ok", replaces: "" })
        .success,
    ).toBe(false);
    expect(
      completionSchema.parse({
        completedOn: "2026-11-01",
        outcome: "completed",
        summary: "Pregled opravljen",
        replaces: "",
      }),
    ).toMatchObject({ replaces: null });
  });

  it("requires reasons and non-empty messages", () => {
    expect(reasonSchema.safeParse("  ").success).toBe(false);
    expect(messageSchema.safeParse({ body: "   ", visibility: "shared" }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "Pozdravljeni", visibility: "public" }).success).toBe(false);
  });
});
