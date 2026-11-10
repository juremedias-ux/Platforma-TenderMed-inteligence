import { z } from "zod";

/**
 * Validation for public inquiry forms. The same schemas run in the browser
 * (for immediate feedback) and on the server (authoritative). Limits match
 * the database CHECK constraints in supabase/migrations.
 */

export const LIMITS = {
  fullNameMin: 2,
  fullNameMax: 120,
  emailMax: 254,
  contactMessageMin: 10,
  contactMessageMax: 4000,
} as const;

/** Collapses internal whitespace and trims; keeps line breaks in messages. */
function cleanSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const fullName = z
  .string({ error: "Vpišite ime in priimek." })
  .transform(cleanSingleLine)
  .pipe(
    z
      .string()
      .min(LIMITS.fullNameMin, { error: "Vpišite ime in priimek." })
      .max(LIMITS.fullNameMax, { error: `Ime in priimek je lahko dolg največ ${LIMITS.fullNameMax} znakov.` })
      .refine((v) => !CONTROL_CHARACTERS.test(v), { error: "Ime vsebuje nedovoljene znake." }),
  );

export const emailSchema = z
  .string({ error: "Vpišite e-poštni naslov." })
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .min(1, { error: "Vpišite e-poštni naslov." })
      .max(LIMITS.emailMax, { error: "E-poštni naslov je predolg." })
      .pipe(z.email({ error: "Vpišite veljaven e-poštni naslov, npr. ime@organizacija.si." })),
  );

function message(options: { min: number; max: number; requiredError?: string }) {
  return z
    .string()
    .transform(cleanMultiline)
    .pipe(
      z
        .string()
        .min(options.min, {
          error: options.requiredError ?? `Sporočilo naj vsebuje vsaj ${options.min} znakov.`,
        })
        .max(options.max, { error: `Sporočilo je lahko dolgo največ ${options.max} znakov.` })
        .refine((v) => !CONTROL_CHARACTERS.test(v.replace(/\n/g, "")), {
          error: "Sporočilo vsebuje nedovoljene znake.",
        }),
    );
}

/** Pilot sign-up: only an e-mail address is collected. */
export const demoRequestSchema = z.object({
  email: emailSchema,
});

export const contactMessageSchema = z.object({
  fullName,
  email: emailSchema,
  message: message({
    min: LIMITS.contactMessageMin,
    max: LIMITS.contactMessageMax,
    requiredError: `Vpišite sporočilo (vsaj ${LIMITS.contactMessageMin} znakov).`,
  }),
});

export type DemoRequestInput = z.input<typeof demoRequestSchema>;
export type DemoRequestData = z.output<typeof demoRequestSchema>;
export type ContactMessageInput = z.input<typeof contactMessageSchema>;
export type ContactMessageData = z.output<typeof contactMessageSchema>;

export type FieldErrors = Partial<Record<string, string>>;

/** First error message per top-level field. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
