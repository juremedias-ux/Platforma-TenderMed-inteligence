import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates/date-only";
import { ljubljanaWallTimeToUtc } from "@/lib/dates/datetime";
import { outcomes, priorities, requestTypes } from "@/lib/service/domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const multiline = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(max, { error: `Največ ${max} znakov.` }));

const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || UUID.test(v), { error: "Neveljavna izbira." })
  .transform((v) => (v === "" ? null : v));

export const serviceRequestSchema = z.object({
  equipmentId: z.string().trim().regex(UUID, { error: "Izberite opremo." }),
  planId: optionalUuid,
  requestType: z.enum(requestTypes, { error: "Izberite vrsto zahtevka." }),
  title: line(3, 160, "Vpišite naslov (vsaj 3 znake)."),
  description: multiline(4000).transform((v) => (v === "" ? null : v)),
  priority: z.enum(priorities, { error: "Izberite nujnost." }),
  replacementNeeded: z.boolean(),
});
export const serviceRequestKeys = ["equipmentId", "planId", "requestType", "title", "description", "priority"];

export const serviceRequestEditSchema = serviceRequestSchema.pick({ title: true, description: true, priority: true });

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const appointmentSchema = z
  .object({
    date: z.string().trim().refine(isValidIsoDate, { error: "Vpišite datum." }),
    startTime: z.string().trim().regex(TIME, { error: "Vpišite začetek (UU:MM)." }),
    endTime: z.string().trim().regex(TIME, { error: "Vpišite konec (UU:MM)." }),
    note: multiline(1000),
  })
  .transform((v, ctx) => {
    const starts = ljubljanaWallTimeToUtc(v.date, v.startTime);
    const ends = ljubljanaWallTimeToUtc(v.date, v.endTime);
    if (!starts)
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Ta ura na ta dan ne obstaja (premik ure)." });
    if (!ends)
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Ta ura na ta dan ne obstaja (premik ure)." });
    if (starts && ends && ends <= starts) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Konec mora biti po začetku." });
    }
    if (starts && starts.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "Termin mora biti v prihodnosti." });
    }
    return { starts: starts?.toISOString() ?? "", ends: ends?.toISOString() ?? "", note: v.note || null };
  });
export const appointmentKeys = ["date", "startTime", "endTime", "note"];

export const completionSchema = z.object({
  completedOn: z.string().trim().refine(isValidIsoDate, { error: "Vpišite datum izvedbe." }),
  outcome: z.enum(outcomes, { error: "Izberite izid." }),
  summary: multiline(4000).pipe(z.string().min(3, { error: "Opišite opravljeno delo (vsaj 3 znake)." })),
  replaces: optionalUuid,
});
export const completionKeys = ["completedOn", "outcome", "summary", "replaces"];

export const reasonSchema = multiline(1000).pipe(z.string().min(3, { error: "Vpišite razlog (vsaj 3 znake)." }));
export const optionalNoteSchema = multiline(1000).transform((v) => (v === "" ? null : v));

export const messageSchema = z.object({
  body: multiline(4000).pipe(z.string().min(1, { error: "Vpišite sporočilo." })),
  visibility: z.enum(["shared", "internal"], { error: "Izberite vidnost." }),
});
