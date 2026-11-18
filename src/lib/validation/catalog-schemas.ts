import { z } from "zod";
import { productTypes } from "@/lib/catalog/domain";
import { isValidIsoDate } from "@/lib/dates/date-only";
import { equipmentCategories } from "@/lib/equipment/domain";

const line = (min: number, max: number, message: string) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(min, { error: message })
        .max(max, { error: `Največ ${max} znakov.` }),
    );

/** "Proizvajalec | Model" per line. */
export function parseCompatibility(text: string) {
  const rows: { manufacturer_name: string; model: string }[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l, index) => {
      const [manufacturer, model, ...rest] = l.split("|").map((part) => part.trim());
      if (!manufacturer || !model || rest.length || manufacturer.length > 120 || model.length > 120) {
        errors.push(`Vrstica ${index + 1}: uporabite obliko »Proizvajalec | Model«.`);
      } else rows.push({ manufacturer_name: manufacturer, model });
    });
  if (rows.length > 100) errors.push("Največ 100 združljivih modelov.");
  return { rows, errors };
}

/** "Naslov | https://… | 2026-01-31" per line (date optional). */
export function parseSources(text: string) {
  const rows: { title: string; url: string; retrieved_on: string }[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l, index) => {
      const [title, url, date = "", ...rest] = l.split("|").map((part) => part.trim());
      let valid = Boolean(title && title.length >= 2 && title.length <= 200 && url && !rest.length);
      try {
        valid = valid && new URL(url!).protocol === "https:" && url!.length <= 500 && !/\s/.test(url!);
      } catch {
        valid = false;
      }
      if (date && !isValidIsoDate(date)) valid = false;
      if (!valid) errors.push(`Vrstica ${index + 1}: uporabite obliko »Naslov | https://… | 2026-01-31«.`);
      else rows.push({ title: title!, url: url!, retrieved_on: date });
    });
  if (rows.length > 20) errors.push("Največ 20 virov.");
  return { rows, errors };
}

export const productSchema = z.object({
  name: line(2, 160, "Vpišite ime izdelka."),
  productType: z.enum(productTypes, { error: "Izberite vrsto." }),
  category: z.enum(equipmentCategories, { error: "Izberite kategorijo." }),
  manufacturerName: line(0, 120, ""),
  model: line(0, 120, ""),
  description: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(4000, { error: "Največ 4000 znakov." })),
});
export const productKeys = [
  "name",
  "productType",
  "category",
  "manufacturerName",
  "model",
  "description",
  "compatibility",
  "sources",
];

export const inquirySchema = z.object({
  message: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().min(3, { error: "Vpišite sporočilo." }).max(2000, { error: "Največ 2000 znakov." })),
});
