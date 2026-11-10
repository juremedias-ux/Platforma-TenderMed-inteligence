import { z } from "zod";
import { emailSchema } from "./inquiry-schemas";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string({ error: "Vpišite geslo." })
  .min(PASSWORD_MIN, { error: `Geslo mora imeti vsaj ${PASSWORD_MIN} znakov.` })
  .max(PASSWORD_MAX, { error: `Geslo je lahko dolgo največ ${PASSWORD_MAX} znakov.` });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Vpišite geslo." }).min(1, { error: "Vpišite geslo." }).max(PASSWORD_MAX),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "Gesli se ne ujemata.", path: ["confirm"] });

export const invitationSignupSchema = z
  .object({
    fullName: z
      .string({ error: "Vpišite ime in priimek." })
      .transform((v) => v.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(2, { error: "Vpišite ime in priimek." }).max(120)),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { error: "Gesli se ne ujemata.", path: ["confirm"] });
