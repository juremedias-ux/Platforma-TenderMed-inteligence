"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/paths";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { allowAttempt, getActionClientIp, getAppOrigin } from "@/lib/security/server-request";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { loginSchema, newPasswordSchema, passwordResetRequestSchema } from "@/lib/validation/auth-schemas";

const NOT_CONFIGURED: ActionState = {
  status: "error",
  message: "Prijava trenutno ni na voljo, ker platforma še ni konfigurirana.",
};

const RATE_LIMITED: ActionState = {
  status: "error",
  message: "Preveč poskusov v kratkem času. Počakajte nekaj minut in poskusite znova.",
};

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", message: "Preverite označena polja.", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };

  const ip = await getActionClientIp();
  if (
    !(await allowAttempt("auth:login:ip", ip, 20, 600)) ||
    !(await allowAttempt("auth:login:email", parsed.data.email, 8, 600))
  ) {
    return { ...RATE_LIMITED, values };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown e-mail and wrong password (no account enumeration).
    return { status: "error", message: "Prijava ni uspela. Preverite e-poštni naslov in geslo.", values };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/prijava");
}

export async function requestPasswordResetAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Preverite označena polja.", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };

  const ip = await getActionClientIp();
  if (
    !(await allowAttempt("auth:reset:ip", ip, 10, 3600)) ||
    !(await allowAttempt("auth:reset:email", parsed.data.email, 3, 3600))
  ) {
    return { ...RATE_LIMITED, values };
  }

  const origin = await getAppOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/ponastavitev-gesla`,
  });
  if (error) console.error(`[auth] password reset request failed: ${error.code ?? error.status ?? "unknown"}`);

  // Neutral response whether or not the account exists or the e-mail was accepted.
  return {
    status: "success",
    message:
      "Če račun s tem e-poštnim naslovom obstaja, smo poslali povezavo za ponastavitev gesla. Povezava je veljavna omejen čas.",
  };
}

export async function updatePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    return { status: "error", message: "Preverite označena polja.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return {
      status: "error",
      message: "Povezava za ponastavitev je potekla ali ni veljavna. Zahtevajte novo povezavo.",
    };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: "Gesla ni bilo mogoče spremeniti. Poskusite z drugim geslom." };
  }
  redirect("/app");
}
