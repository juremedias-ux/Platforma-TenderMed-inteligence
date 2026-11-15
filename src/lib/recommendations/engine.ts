import { addDays, diffInDays, type IsoDate } from "@/lib/dates/date-only";
import { daysAccusative, formatDate } from "@/lib/dates/format";
import { equipmentCategoryLabels, isOneOf, equipmentCategories } from "@/lib/equipment/domain";
import type { ProductType } from "@/lib/catalog/domain";

/**
 * Deterministic, explainable recommendations.
 *
 * Inputs are the organization's own equipment and open due dates and the
 * published catalog of approved suppliers. Rules:
 *   compatible     accessory / consumable / spare part whose compatibility
 *                  list names the manufacturer and model of owned equipment;
 *   service_due    service offered for a category with overdue due dates or
 *                  due dates within SERVICE_WINDOW_DAYS;
 *   warranty_end   service offered for a category whose equipment warranty
 *                  ends within WARRANTY_WINDOW_DAYS.
 * Ordering: overdue services, ending warranties, upcoming services,
 * compatible items; then the earliest date, product name and id. The
 * supplier's commercial relationship is never used for ranking.
 */

export const SERVICE_WINDOW_DAYS = 60;
export const WARRANTY_WINDOW_DAYS = 90;

export interface EquipmentFact {
  id: string;
  name: string;
  category: string;
  manufacturer_name: string | null;
  model: string | null;
  warranty_end_date: IsoDate | null;
  status: string;
}

export interface DueFact {
  equipment_id: string;
  next_due_date: IsoDate;
}

export interface ProductFact {
  id: string;
  name: string;
  product_type: ProductType;
  category: string;
  compatibility: { manufacturer_name: string; model: string }[];
}

export type RuleId = "compatible" | "service_due" | "warranty_end";

export interface Recommendation {
  productId: string;
  rule: RuleId;
  ruleKey: string;
  reasons: string[];
  equipmentIds: string[];
  /** Lower is more urgent. */
  rank: number;
  sortDate: IsoDate | null;
}

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const categoryLabel = (category: string) =>
  isOneOf(equipmentCategories, category) ? equipmentCategoryLabels[category] : category;

function countLabel(n: number, forms: [string, string, string, string]) {
  const m = n % 100;
  return `${n} ${m === 1 ? forms[0] : m === 2 ? forms[1] : m === 3 || m === 4 ? forms[2] : forms[3]}`;
}

export function buildRecommendations(input: {
  equipment: EquipmentFact[];
  dueDates: DueFact[];
  products: ProductFact[];
  today: IsoDate;
}): Recommendation[] {
  const { today } = input;
  const active = input.equipment.filter((e) => e.status !== "archived");
  const byId = new Map(active.map((e) => [e.id, e]));
  const results: Recommendation[] = [];

  // compatible
  for (const product of input.products) {
    if (!["accessory", "consumable", "spare_part"].includes(product.product_type)) continue;
    const keys = new Set(product.compatibility.map((c) => `${normalize(c.manufacturer_name)}|${normalize(c.model)}`));
    const matches = active.filter(
      (e) => e.manufacturer_name && e.model && keys.has(`${normalize(e.manufacturer_name)}|${normalize(e.model)}`),
    );
    if (matches.length === 0) continue;
    const models = [...new Set(matches.map((e) => `${e.manufacturer_name} ${e.model}`))].sort();
    results.push({
      productId: product.id,
      rule: "compatible",
      ruleKey: "compatible:all",
      reasons: [
        `Dobavitelj navaja združljivost z modelom ${models.join(", ")}.`,
        `V vašem registru: ${countLabel(matches.length, ["naprava", "napravi", "naprave", "naprav"])} tega modela.`,
      ],
      equipmentIds: matches.map((e) => e.id).sort(),
      rank: 3,
      sortDate: null,
    });
  }

  // service_due
  const windowEnd = addDays(today, SERVICE_WINDOW_DAYS);
  const dueByCategory = new Map<string, { overdue: DueFact[]; upcoming: DueFact[] }>();
  for (const due of input.dueDates) {
    const equipment = byId.get(due.equipment_id);
    if (!equipment || due.next_due_date > windowEnd) continue;
    const entry = dueByCategory.get(equipment.category) ?? { overdue: [], upcoming: [] };
    (due.next_due_date < today ? entry.overdue : entry.upcoming).push(due);
    dueByCategory.set(equipment.category, entry);
  }
  // warranty_end
  const warrantyEnd = addDays(today, WARRANTY_WINDOW_DAYS);
  const warrantyByCategory = new Map<string, EquipmentFact[]>();
  for (const e of active) {
    if (!e.warranty_end_date || e.warranty_end_date < today || e.warranty_end_date > warrantyEnd) continue;
    warrantyByCategory.set(e.category, [...(warrantyByCategory.get(e.category) ?? []), e]);
  }

  for (const product of input.products) {
    if (product.product_type !== "service") continue;
    const due = dueByCategory.get(product.category);
    if (due) {
      const all = [...due.overdue, ...due.upcoming].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
      const reasons: string[] = [];
      if (due.overdue.length) {
        reasons.push(
          `${categoryLabel(product.category)}: ${countLabel(due.overdue.length, ["zamujen rok", "zamujena roka", "zamujeni roki", "zamujenih rokov"])} (najstarejši ${formatDate(due.overdue.map((d) => d.next_due_date).sort()[0]!)}).`,
        );
      }
      if (due.upcoming.length) {
        reasons.push(
          `${categoryLabel(product.category)}: ${countLabel(due.upcoming.length, ["rok", "roka", "roki", "rokov"])} v naslednjih ${SERVICE_WINDOW_DAYS} dneh (najbližji ${formatDate(due.upcoming.map((d) => d.next_due_date).sort()[0]!)}).`,
        );
      }
      results.push({
        productId: product.id,
        rule: "service_due",
        ruleKey: `service_due:${product.category}`,
        reasons,
        equipmentIds: [...new Set(all.map((d) => d.equipment_id))].sort(),
        rank: due.overdue.length ? 0 : 2,
        sortDate: all[0]!.next_due_date,
      });
    }
    const ending = warrantyByCategory.get(product.category);
    if (ending) {
      const sorted = [...ending].sort((a, b) => a.warranty_end_date!.localeCompare(b.warranty_end_date!));
      results.push({
        productId: product.id,
        rule: "warranty_end",
        ruleKey: `warranty_end:${product.category}`,
        reasons: sorted.map(
          (e) =>
            `Garancija za ${e.name} poteče ${formatDate(e.warranty_end_date!)} (čez ${diffInDays(today, e.warranty_end_date!)} ${daysAccusative(diffInDays(today, e.warranty_end_date!))}).`,
        ),
        equipmentIds: sorted.map((e) => e.id),
        rank: 1,
        sortDate: sorted[0]!.warranty_end_date,
      });
    }
  }

  const names = new Map(input.products.map((p) => [p.id, p.name]));
  return results.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.sortDate ?? "9999").localeCompare(b.sortDate ?? "9999") ||
      (names.get(a.productId) ?? "").localeCompare(names.get(b.productId) ?? "", "sl") ||
      a.productId.localeCompare(b.productId) ||
      a.ruleKey.localeCompare(b.ruleKey),
  );
}
