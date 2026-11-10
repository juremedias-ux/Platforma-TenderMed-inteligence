"use server";

import { redirect } from "next/navigation";
import { byteaHex, hashInvitationToken, isWellFormedToken } from "@/lib/auth/tokens";
import { dbErrorMessage } from "@/lib/db/errors";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { allowAttempt, getActionClientIp } from "@/lib/security/server-request";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { invitationSignupSchema } from "@/lib/validation/auth-schemas";

type AcceptResult = { organization_id: string; kind: string; service_request_id: string | null };

function destination(result: AcceptResult | undefined): string {
  if (!result) return "/app";
  if (result.kind === "service_assignment" && result.service_request_id) {
    return `/app/servisne-naloge/${result.service_request_id}`;
  }
  return `/app/${result.organization_id}/pregled`;
}

/** Accepts an invitation as the signed-in user (verified e-mail must match). */
export async function acceptInvitationAction(token: string): Promise<ActionState> {
  if (!isWellFormedToken(token)) return { status: "error", message: "Povezava povabila ni veljavna." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", message: "Platforma še ni konfigurirana." };

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: byteaHex(hashInvitationToken(token)),
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  redirect(destination((data as AcceptResult[] | null)?.[0]));
}

/**
 * Creates an account for the invited e-mail address and accepts the
 * invitation. Possession of the single-use token is the proof of the
 * e-mail address (the link is delivered to that address). The account is
 * therefore created as confirmed. See docs/security-model.md for the limits
 * of this proof when invitation links are delivered manually.
 */
export async function createAccountAndAcceptAction(
  token: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["fullName"]);
  if (!isWellFormedToken(token)) return { status: "error", message: "Povezava povabila ni veljavna.", values };

  const parsed = invitationSignupSchema.safeParse({
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Preverite označena polja.", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = getSupabaseAdminClient();
  if (!supabase || !adminClient) return { status: "error", message: "Platforma še ni konfigurirana.", values };

  if (!(await allowAttempt("auth:invite-signup:ip", await getActionClientIp(), 10, 3600))) {
    return { status: "error", message: "Preveč poskusov. Poskusite znova čez nekaj minut.", values };
  }

  const tokenHash = byteaHex(hashInvitationToken(token));
  const { data: preview, error: previewError } = await supabase.rpc("get_invitation_preview", {
    p_token_hash: tokenHash,
  });
  const invitation = (preview as { email: string; status: string }[] | null)?.[0];
  if (previewError || !invitation) return { status: "error", message: "Povabilo ne obstaja.", values };
  if (invitation.status !== "pending") {
    return { status: "error", message: "Povabilo ni več veljavno (sprejeto, preklicano ali poteklo).", values };
  }

  const { error: createError } = await adminClient.auth.admin.createUser({
    email: invitation.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (createError) {
    const exists = createError.code === "email_exists" || /already/i.test(createError.message);
    return {
      status: "error",
      message: exists
        ? "Račun s tem e-poštnim naslovom že obstaja. Prijavite se in nato sprejmite povabilo."
        : "Računa ni bilo mogoče ustvariti. Poskusite z drugim geslom ali kasneje.",
      values,
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: parsed.data.password,
  });
  if (signInError) {
    return { status: "error", message: "Račun je ustvarjen. Prijavite se in odprite povezavo povabila znova.", values };
  }

  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: tokenHash });
  if (error) return { status: "error", message: dbErrorMessage(error), values };
  redirect(destination((data as AcceptResult[] | null)?.[0]));
}
