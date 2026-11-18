import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates/date-only";
import {
  activityTypes,
  equipmentCategories,
  equipmentStatuses,
  scheduleModes,
  sourceBases,
} from "@/lib/equipment/domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, { error: `Največ ${max} znakov.` }));

const optionalText = (max: number) => text(max).transform((v) => (v === "" ? null : v));

const multilineText = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(max, { error: `Največ ${max} znakov.` }))
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIsoDate(v), { error: "Vpišite veljaven datum." })
  .transform((v) => (v === "" ? null : v));

const requiredDate = z
  .string()
  .trim()
  .refine((v) => isValidIsoDate(v), { error: "Vpišite veljaven datum." });

const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || UUID.test(v), { error: "Neveljavna izbira." })
  .transform((v) => (v === "" ? null : v));

export const versionSchema = z.coerce.number().int().min(1);

export const equipmentSchema = z
  .object({
    name: text(160).pipe(z.string().min(2, { error: "Vpišite naziv opreme." })),
    category: z.enum(equipmentCategories, { error: "Izberite kategorijo." }),
    assetTag: optionalText(64),
    manufacturerName: optionalText(120),
    model: optionalText(120),
    serialNumber: optionalText(120),
    locationId: optionalUuid,
    newLocation: optionalText(120),
    responsibleUserId: optionalUuid,
    purchaseDate: optionalDate,
    commissioningDate: optionalDate,
    warrantyEndDate: optionalDate,
    status: z.enum(equipmentStatuses, { error: "Izberite status." }),
    notes: multilineText(4000),
  })
  .refine((v) => !(v.locationId && v.newLocation), {
    path: ["newLocation"],
    error: "Izberite obstoječo lokacijo ali vpišite novo, ne obojega.",
  });

export type EquipmentInput = z.infer<typeof equipmentSchema>;

export const equipmentFormKeys = [
  "name",
  "category",
  "assetTag",
  "manufacturerName",
  "model",
  "serialNumber",
  "locationId",
  "newLocation",
  "responsibleUserId",
  "purchaseDate",
  "commissioningDate",
  "warrantyEndDate",
  "status",
  "notes",
] as const;

export const reminderDaysSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return [] as number[];
    const parts = v.split(/[\s,;]+/).filter(Boolean);
    const numbers = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
    if (numbers.some((n) => Number.isNaN(n) || n > 365) || numbers.length > 5) {
      ctx.addIssue({ code: "custom", message: "Vpišite do 5 števil dni (0–365), ločenih z vejico." });
      return z.NEVER;
    }
    return [...new Set(numbers)].sort((a, b) => b - a);
  });

export const planSchema = z
  .object({
    activityType: z.enum(activityTypes, { error: "Izberite vrsto aktivnosti." }),
    activityLabel: optionalText(120),
    scheduleMode: z.enum(scheduleModes, { error: "Izberite način določanja rokov." }),
    intervalMonths: z.string().trim(),
    anchorDate: z.string().trim(),
    dueDate: z.string().trim(),
    responsibleUserId: optionalUuid,
    reminderDays: reminderDaysSchema,
    sourceBasis: z.enum(sourceBases, { error: "Izberite podlago za interval." }),
    sourceNote: optionalText(500),
  })
  .transform((v, ctx) => {
    if (v.activityType === "other" && (!v.activityLabel || v.activityLabel.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["activityLabel"], message: "Opišite aktivnost." });
    }
    if (v.activityLabel && v.activityLabel.length < 2) {
      ctx.addIssue({ code: "custom", path: ["activityLabel"], message: "Vsaj 2 znaka." });
    }
    let intervalMonths: number | null = null;
    let anchorDate: string | null = null;
    let dueDate: string | null = null;
    if (v.scheduleMode === "one_off") {
      if (!requiredDate.safeParse(v.dueDate).success) {
        ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Vpišite rok." });
      } else dueDate = v.dueDate;
    } else {
      const interval = /^\d{1,3}$/.test(v.intervalMonths) ? Number(v.intervalMonths) : Number.NaN;
      if (!(interval >= 1 && interval <= 120)) {
        ctx.addIssue({ code: "custom", path: ["intervalMonths"], message: "Interval mora biti od 1 do 120 mesecev." });
      } else intervalMonths = interval;
      if (!requiredDate.safeParse(v.anchorDate).success) {
        ctx.addIssue({ code: "custom", path: ["anchorDate"], message: "Vpišite začetni rok." });
      } else anchorDate = v.anchorDate;
    }
    return {
      activityType: v.activityType,
      activityLabel: v.activityLabel,
      scheduleMode: v.scheduleMode,
      intervalMonths,
      anchorDate,
      dueDate,
      responsibleUserId: v.responsibleUserId,
      reminderDays: v.reminderDays,
      sourceBasis: v.sourceBasis,
      sourceNote: v.sourceNote,
    };
  });

export type PlanInput = z.infer<typeof planSchema>;

export const planFormKeys = [
  "activityType",
  "activityLabel",
  "scheduleMode",
  "intervalMonths",
  "anchorDate",
  "dueDate",
  "responsibleUserId",
  "reminderDays",
  "sourceBasis",
  "sourceNote",
] as const;

export const locationNameSchema = text(120).pipe(z.string().min(1, { error: "Vpišite ime lokacije." }));
