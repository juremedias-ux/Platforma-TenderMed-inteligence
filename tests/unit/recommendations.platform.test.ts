import { describe, expect, it } from "vitest";
import { buildRecommendations, type EquipmentFact, type ProductFact } from "@/lib/recommendations/engine";

const TODAY = "2026-11-10";

const equipment: EquipmentFact[] = [
  {
    id: "e1",
    name: "Monitor A",
    category: "patient_monitoring",
    manufacturer_name: "Acme",
    model: "VM-200",
    warranty_end_date: "2027-01-15",
    status: "active",
  },
  {
    id: "e2",
    name: "Monitor B",
    category: "patient_monitoring",
    manufacturer_name: "ACME ",
    model: "vm-200",
    warranty_end_date: null,
    status: "active",
  },
  {
    id: "e3",
    name: "Črpalka",
    category: "infusion",
    manufacturer_name: "Flow",
    model: "P1",
    warranty_end_date: "2026-11-01",
    status: "active",
  },
  {
    id: "e4",
    name: "Stara",
    category: "infusion",
    manufacturer_name: "Acme",
    model: "VM-200",
    warranty_end_date: null,
    status: "archived",
  },
];

const products: ProductFact[] = [
  {
    id: "p1",
    name: "Senzor SpO2",
    product_type: "accessory",
    category: "patient_monitoring",
    compatibility: [{ manufacturer_name: "acme", model: "VM-200" }],
  },
  { id: "p2", name: "Servis monitorjev", product_type: "service", category: "patient_monitoring", compatibility: [] },
  { id: "p3", name: "Servis črpalk", product_type: "service", category: "infusion", compatibility: [] },
  {
    id: "p4",
    name: "Kabel",
    product_type: "accessory",
    category: "ecg",
    compatibility: [{ manufacturer_name: "Other", model: "X" }],
  },
  {
    id: "p5",
    name: "Nov monitor",
    product_type: "device",
    category: "patient_monitoring",
    compatibility: [{ manufacturer_name: "Acme", model: "VM-200" }],
  },
];

describe("platform recommendations", () => {
  const result = buildRecommendations({
    equipment,
    dueDates: [
      { equipment_id: "e3", next_due_date: "2026-11-01" },
      { equipment_id: "e1", next_due_date: "2026-12-20" },
      { equipment_id: "e2", next_due_date: "2027-06-01" },
      { equipment_id: "e4", next_due_date: "2026-10-01" },
    ],
    products,
    today: TODAY,
  });

  it("applies the rules and orders by urgency deterministically", () => {
    expect(result.map((r) => `${r.rule}:${r.productId}`)).toEqual([
      "service_due:p3",
      "warranty_end:p2",
      "service_due:p2",
      "compatible:p1",
    ]);
  });

  it("explains each recommendation with the facts used", () => {
    const compatible = result.find((r) => r.rule === "compatible")!;
    expect(compatible.equipmentIds).toEqual(["e1", "e2"]);
    expect(compatible.reasons[1]).toBe("V vašem registru: 2 napravi tega modela.");
    const overdue = result.find((r) => r.productId === "p3")!;
    expect(overdue.reasons).toEqual(["Infuzijske črpalke: 1 zamujen rok (najstarejši 1. 11. 2026)."]);
    expect(overdue.ruleKey).toBe("service_due:infusion");
    const warranty = result.find((r) => r.rule === "warranty_end")!;
    expect(warranty.reasons).toEqual(["Garancija za Monitor A poteče 15. 1. 2027 (čez 66 dni)."]);
  });

  it("ignores archived equipment, devices for compatibility, expired warranties and far due dates", () => {
    expect(result.some((r) => r.productId === "p5" || r.productId === "p4")).toBe(false);
    expect(result.flatMap((r) => r.equipmentIds)).not.toContain("e4");
    const upcoming = result.find((r) => r.productId === "p2" && r.rule === "service_due")!;
    expect(upcoming.equipmentIds).toEqual(["e1"]);
  });

  it("returns the same output for the same input", () => {
    const again = buildRecommendations({
      equipment: [...equipment].reverse(),
      dueDates: [],
      products: [...products].reverse(),
      today: TODAY,
    });
    const once = buildRecommendations({ equipment, dueDates: [], products, today: TODAY });
    expect(again).toEqual(once);
  });
});
