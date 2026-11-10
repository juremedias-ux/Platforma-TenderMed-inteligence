"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AuthorizationError, getSessionUser, getUserClient, isUuid, requireOrgPermission } from "@/lib/auth/session";
import { byteaHex, createInvitationToken } from "@/lib/auth/tokens";
import { dbErrorMessage, registerErrorMessages } from "@/lib/db/errors";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { sendPendingEmailsQuietly } from "@/lib/notifications/outbox";
import { getAppOrigin } from "@/lib/security/server-request";
import { isOneOf } from "@/lib/equipment/domain";
import { replacementStatuses, requestStatuses } from "@/lib/service/domain";
import { emailSchema } from "@/lib/validation/inquiry-schemas";
import {
  appointmentKeys,
  appointmentSchema,
  completionKeys,
  completionSchema,
  messageSchema,
  optionalNoteSchema,
  reasonSchema,
  serviceRequestEditSchema,
  serviceRequestKeys,
  serviceRequestSchema,
} from "@/lib/validation/service-schemas";

/**
 * Service collaboration actions. They are shared by organization members
 * and request-scoped assignees: authorization is decided by the database
 * functions (transition_service_request, record_completion, …) for the
 * calling user, and checked again here where a permission applies.
 */

registerErrorMessages({
  TM_NOT_FOUND: "Zahtevek ne obstaja ali do njega nimate dostopa.",
  TM_FORBIDDEN: "Za to dejanje nimate dovoljenja.",
  TM_REQUEST_CLOSED: "Zahtevek je zaključen ali preklican.",
  TM_TRANSITION_NOT_ALLOWED: "Tega koraka v trenutnem stanju zahtevka ni mogoče izvesti.",
  TM_REASON_REQUIRED: "Vpišite razlog.",
  TM_REQUEST_HAS_COMPLETION: "Zahtevek ima zabeleženo izvedbo. Pred preklicem jo mora skrbnik razveljaviti.",
  TM_COMPLETION_REQUIRED: "Za zaključek je potrebna potrjena izvedba.",
  TM_REPLACEMENT_OPEN: "Nadomestna oprema še ni vrnjena ali preklicana.",
  TM_APPOINTMENT_INVALID: "Termin mora biti v prihodnosti in trajati največ 14 dni.",
  TM_PROPOSAL_CLOSED: "O tem predlogu termina je že odločeno.",
  TM_PROPOSAL_IN_PAST: "Predlagani termin je že minil. Predlagajte novega.",
  TM_COMPLETION_EXISTS: "Izvedba je že zabeležena.",
  TM_COMPLETION_DATE_INVALID: "Datum izvedbe ne sme biti v prihodnosti.",
  TM_INVALID_REPLACEMENT: "Popravek se lahko nanaša samo na razveljavljen zapis istega zahtevka.",
  TM_COMPLETION_NOT_PENDING: "Izvedba ne čaka na potrditev.",
  TM_ALREADY_VOIDED: "Zapis je že razveljavljen.",
  TM_PLAN_MISMATCH: "Izbrani servisni načrt ne pripada tej opremi ali ni aktiven.",
  TM_EQUIPMENT_ARCHIVED: "Za arhivirano opremo ni mogoče odpreti zahtevka.",
});

const FORBIDDEN: ActionState = { status: "error", message: "Za to dejanje nimate dovoljenja." };

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof AuthorizationError) return { ...FORBIDDEN, values };
  return { status: "error", message: dbErrorMessage(error), values };
}

/** Client for the signed-in caller (member or assignee); RLS and RPC checks apply. */
async function sessionClient() {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("TM_NOT_AUTHENTICATED");
  return getUserClient();
}

async function rpc(name: string, params: Record<string, unknown>, success: string): Promise<ActionState> {
  try {
    const supabase = await sessionClient();
    const { error } = await supabase.rpc(name, params);
    if (error) return failure(error);
  } catch (error) {
    return failure(error);
  }
  // Notifications were queued by database triggers; send their e-mails after the response.
  after(sendPendingEmailsQuietly);
  refresh();
  return { status: "success", message: success };
}

export async function createServiceRequestAction(
  organizationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, serviceRequestKeys);
  const parsed = serviceRequestSchema.safeParse({
    ...values,
    replacementNeeded: formData.get("replacementNeeded") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  let id: string;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "service.create");
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        organization_id: organizationId,
        equipment_id: parsed.data.equipmentId,
        plan_id: parsed.data.planId,
        request_type: parsed.data.requestType,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        replacement_status: parsed.data.replacementNeeded ? "requested" : "not_needed",
      })
      .select("id")
      .single();
    if (error) return failure(error, values);
    id = data.id;
  } catch (error) {
    return failure(error, values);
  }
  redirect(`/app/${organizationId}/servisi/${id}`);
}

export async function updateServiceRequestAction(
  organizationId: string,
  requestId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["title", "description", "priority"]);
  const parsed = serviceRequestEditSchema.safeParse(values);
  const version = Number(formData.get("version"));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!Number.isInteger(version) || !isUuid(requestId)) return { status: "error", message: "Neveljaven zahtevek." };
  try {
    const { supabase } = await requireOrgPermission(organizationId, "service.coordinate");
    const { data, error } = await supabase
      .from("service_requests")
      .update(parsed.data)
      .eq("organization_id", organizationId)
      .eq("id", requestId)
      .eq("version", version)
      .select("id");
    if (error) return failure(error, values);
    if (!data?.length) {
      return {
        status: "error",
        message: "Podatke je medtem spremenil nekdo drug. Osvežite stran in poskusite znova.",
        values,
      };
    }
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: "Zahtevek je shranjen." };
}

export async function transitionRequestAction(
  requestId: string,
  version: number,
  to: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(requestId) || !isOneOf(requestStatuses, to)) return FORBIDDEN;
  let note: string | null = null;
  if (to === "preklicano") {
    const parsed = reasonSchema.safeParse(String(formData.get("note") ?? ""));
    if (!parsed.success) return { status: "error", fieldErrors: { note: parsed.error.issues[0]?.message } };
    note = parsed.data;
  }
  return rpc(
    "transition_service_request",
    { p_request: requestId, p_version: version, p_to: to, p_note: note },
    "Stanje zahtevka je posodobljeno.",
  );
}

export async function proposeAppointmentAction(
  requestId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, appointmentKeys);
  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!isUuid(requestId)) return FORBIDDEN;
  const result = await rpc(
    "propose_appointment",
    { p_request: requestId, p_starts: parsed.data.starts, p_ends: parsed.data.ends, p_note: parsed.data.note },
    "Termin je predlagan.",
  );
  return result.status === "error" ? { ...result, values } : result;
}

export async function respondAppointmentAction(proposalId: string, action: "accept" | "decline" | "withdraw") {
  if (!isUuid(proposalId)) return FORBIDDEN;
  const messages = {
    accept: "Termin je potrjen.",
    decline: "Predlog termina je zavrnjen.",
    withdraw: "Predlog je umaknjen.",
  };
  return rpc("respond_appointment", { p_proposal: proposalId, p_action: action, p_note: null }, messages[action]);
}

export async function recordCompletionAction(
  requestId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, completionKeys);
  const parsed = completionSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!isUuid(requestId)) return FORBIDDEN;
  const result = await rpc(
    "record_completion",
    {
      p_request: requestId,
      p_completed_on: parsed.data.completedOn,
      p_outcome: parsed.data.outcome,
      p_summary: parsed.data.summary,
      p_replaces: parsed.data.replaces,
    },
    "Izvedba je zabeležena.",
  );
  return result.status === "error" ? { ...result, values } : result;
}

export async function acknowledgeCompletionAction(
  completionId: string,
  accept: boolean,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(completionId)) return FORBIDDEN;
  const raw = String(formData.get("note") ?? "");
  const parsed = accept ? optionalNoteSchema.safeParse(raw) : reasonSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: { note: parsed.error.issues[0]?.message }, values: { note: raw } };
  return rpc(
    "acknowledge_completion",
    { p_completion: completionId, p_accept: accept, p_note: parsed.data },
    accept ? "Izvedba je potrjena." : "Izvedba je zavrnjena in vrnjena izvajalcu.",
  );
}

export async function voidCompletionAction(
  completionId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(completionId)) return FORBIDDEN;
  const raw = String(formData.get("reason") ?? "");
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: { reason: parsed.error.issues[0]?.message }, values: { reason: raw } };
  return rpc(
    "void_completion",
    { p_completion: completionId, p_reason: parsed.data },
    "Zapis je razveljavljen. Po potrebi vnesite popravljen zapis.",
  );
}

export async function setReplacementStatusAction(requestId: string, version: number, status: string) {
  if (!isUuid(requestId) || !isOneOf(replacementStatuses, status)) return FORBIDDEN;
  return rpc(
    "set_replacement_status",
    { p_request: requestId, p_version: version, p_status: status },
    "Stanje nadomestne opreme je posodobljeno.",
  );
}

export async function postMessageAction(
  organizationId: string,
  requestId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["body", "visibility"]);
  const parsed = messageSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!isUuid(organizationId) || !isUuid(requestId)) return FORBIDDEN;
  try {
    const supabase = await sessionClient();
    const { error } = await supabase.from("service_messages").insert({
      organization_id: organizationId,
      service_request_id: requestId,
      visibility: parsed.data.visibility,
      body: parsed.data.body,
    });
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }
  after(sendPendingEmailsQuietly);
  refresh();
  return { status: "success", message: "Sporočilo je poslano." };
}

export async function inviteAssigneeAction(
  organizationId: string,
  requestId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) return { status: "error", fieldErrors: { email: parsed.error.issues[0]?.message }, values };
  if (!isUuid(requestId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "service.assign");
    const { token, hashHex } = createInvitationToken();
    const { error } = await supabase.from("invitations").insert({
      organization_id: organizationId,
      kind: "service_assignment",
      email: parsed.data,
      service_request_id: requestId,
      token_hash: byteaHex(hashHex),
    });
    if (error) {
      if (error.code === "23505") {
        return { status: "error", message: "Za ta naslov že obstaja aktivno povabilo za ta zahtevek.", values };
      }
      return failure(error, values);
    }
    const link = `${await getAppOrigin()}/povabilo/${token}`;
    refresh();
    return {
      status: "success",
      message: "Povabilo je ustvarjeno. Povezavo pošljite serviserju; prikazana je samo enkrat.",
      result: { link, email: parsed.data },
    };
  } catch (error) {
    return failure(error, values);
  }
}

export async function revokeAssignmentAction(organizationId: string, assignmentId: string): Promise<ActionState> {
  if (!isUuid(assignmentId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "service.assign");
    const { data, error } = await supabase
      .from("service_assignments")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", assignmentId)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Dostop je odvzet." };
}
