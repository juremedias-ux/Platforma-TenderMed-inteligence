import { describe, expect, it } from "vitest";
import { parseCompatibility, parseSources, productSchema } from "@/lib/validation/catalog-schemas";

describe("catalog input", () => {
  it("parses compatibility lines strictly", () => {
    expect(parseCompatibility("Acme | VM-200\n\n  Philips|MX450  ")).toEqual({
      rows: [
        { manufacturer_name: "Acme", model: "VM-200" },
        { manufacturer_name: "Philips", model: "MX450" },
      ],
      errors: [],
    });
    expect(parseCompatibility("samo model").errors).toHaveLength(1);
    expect(parseCompatibility("a | b | c").errors).toHaveLength(1);
  });

  it("accepts only https sources with optional ISO dates", () => {
    expect(parseSources("Tehnični list | https://example.com/a.pdf | 2026-11-01").rows).toEqual([
      { title: "Tehnični list", url: "https://example.com/a.pdf", retrieved_on: "2026-11-01" },
    ]);
    expect(parseSources("Vir | http://example.com").errors).toHaveLength(1);
    expect(parseSources("Vir | javascript:alert(1)").errors).toHaveLength(1);
    expect(parseSources("Vir | https://example.com | 31.1.2026").errors).toHaveLength(1);
  });

  it("validates product fields", () => {
    expect(
      productSchema.safeParse({
        name: "X",
        productType: "device",
        category: "ecg",
        manufacturerName: "",
        model: "",
        description: "",
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        name: "Elektrode",
        productType: "consumable",
        category: "ecg",
        manufacturerName: "",
        model: "",
        description: "",
      }).success,
    ).toBe(true);
  });
});
