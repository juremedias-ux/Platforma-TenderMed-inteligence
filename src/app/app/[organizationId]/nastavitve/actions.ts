"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assignableRoles, invitableRoles, isOrgRole, orgRoles } from "@/lib/auth/permissions";
import { AuthorizationError, requireOrgPermission } from "@/lib/auth/session";
import { byteaHex, createInvitationToken } from "@/lib/auth/tokens";
import { dbErrorMessage } from "@/lib/db/errors";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { getAppOrigin } from "@/lib/security/server-request";
import { emailSchema } from "@/lib/validation/inquiry-schemas";

const FORBIDDEN: ActionState = { status: "error", message: "Za to dejanje nimate dovoljenja." };

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof AuthorizationError) return { ...FORBIDDEN, values };
  return { status: "error", message: dbErrorMessage(error), values };
}

const organizationSchema = z.object({
  name: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, { error: "Vpišite ime organizacije." }).max(160)),
  requireAcknowledgment: z.boolean(),
});

export async function updateOrganizationAction(
  organizationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["name"]);
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    requireAcknowledgment: formData.get("requireAcknowledgment") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "org.settings");
    const { error } = await supabase
      .from("organizations")
      .update({ name: parsed.data.name, require_completion_acknowledgment: parsed.data.requireAcknowledgment })
      .eq("id", organizationId);
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Nastavitve organizacije so shranjene." };
}

export async function changeMemberRoleAction(
  organizationId: string,
  userId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const role = String(formData.get("role") ?? "");
  if (!isOrgRole(role)) return { status: "error", message: "Izberite veljavno vlogo." };
  try {
    const context = await requireOrgPermission(organizationId, "members.manage");
    const { data: target, error: targetError } = await context.supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError) return failure(targetError);
    if (!target || !isOrgRole(target.role)) return { status: "error", message: "Član ne obstaja." };
    if (!assignableRoles(context.role, target.role).includes(role)) return FORBIDDEN;

    const { data, error } = await context.supabase
      .from("organization_memberships")
      .update({ role })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .select("role");
    if (error) return failure(error);
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Vloga je spremenjena." };
}

export async function removeMemberAction(organizationId: string, userId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireOrgPermission(organizationId, "members.manage");
    const { data, error } = await supabase
      .from("organization_memberships")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return failure(error);
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Član je odstranjen iz organizacije." };
}

const invitationSchema = z.object({ email: emailSchema, role: z.enum(orgRoles, { error: "Izberite vlogo." }) });

export async function createInvitationAction(
  organizationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["email", "role"]);
  const parsed = invitationSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    const context = await requireOrgPermission(organizationId, "invitations.manage");
    if (!invitableRoles(context.role).includes(parsed.data.role)) return { ...FORBIDDEN, values };

    const { token, hashHex } = createInvitationToken();
    const { error } = await context.supabase.from("invitations").insert({
      organization_id: organizationId,
      kind: "membership",
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash: byteaHex(hashHex),
    });
    if (error) {
      if (error.code === "23505") {
        return {
          status: "error",
          message: "Za ta naslov že obstaja aktivno povabilo. Prekličite ga in ustvarite novo.",
          values,
        };
      }
      return failure(error, values);
    }
    const link = `${await getAppOrigin()}/povabilo/${token}`;
    refresh();
    return {
      status: "success",
      message: "Povabilo je ustvarjeno. Povezavo kopirajte in jo pošljite povabljeni osebi; prikazana je samo enkrat.",
      result: { link, email: parsed.data.email },
    };
  } catch (error) {
    return failure(error, values);
  }
}

export async function revokeInvitationAction(organizationId: string, invitationId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireOrgPermission(organizationId, "invitations.manage");
    const { data, error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("organization_id", organizationId)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Povabilo je preklicano." };
}
