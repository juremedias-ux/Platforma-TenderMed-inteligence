"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { AuthorizationError, isUuid, requireOrgPermission } from "@/lib/auth/session";
import { productStatuses } from "@/lib/catalog/domain";
import { dbErrorMessage, registerErrorMessages } from "@/lib/db/errors";
import { isOneOf } from "@/lib/equipment/domain";
import { fieldErrorsOf, formValues, type ActionState } from "@/lib/forms/action-state";
import { sendPendingEmailsQuietly } from "@/lib/notifications/outbox";
import {
  inquirySchema,
  parseCompatibility,
  parseSources,
  productKeys,
  productSchema,
} from "@/lib/validation/catalog-schemas";

registerErrorMessages({
  TM_PRODUCT_NOT_AVAILABLE: "Izdelek ni (več) objavljen.",
  TM_FORBIDDEN: "Za to dejanje nimate dovoljenja.",
  TM_VERSION_CONFLICT: "Podatke je medtem spremenil nekdo drug. Osvežite stran in poskusite znova.",
});

const FORBIDDEN: ActionState = { status: "error", message: "Za to dejanje nimate dovoljenja." };
const RULE_KEY = /^[a-z_]+:[0-9a-z_:-]{1,120}$/;

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof AuthorizationError) return { ...FORBIDDEN, values };
  return { status: "error", message: dbErrorMessage(error), values };
}

export async function saveProductAction(
  organizationId: string,
  productId: string | null,
  version: number | null,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, productKeys);
  const parsed = productSchema.safeParse(values);
  const compatibility = parseCompatibility(values.compatibility ?? "");
  const sources = parseSources(values.sources ?? "");
  const fieldErrors: Partial<Record<string, string>> = parsed.success ? {} : fieldErrorsOf(parsed.error);
  if (compatibility.errors.length) fieldErrors.compatibility = compatibility.errors.join(" ");
  if (sources.errors.length) fieldErrors.sources = sources.errors.join(" ");
  if (!parsed.success || Object.keys(fieldErrors).length) return { status: "error", fieldErrors, values };
  if (productId && !isUuid(productId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "catalog.manage");
    const { error } = await supabase.rpc("save_catalog_product", {
      p_supplier: organizationId,
      p_product: productId,
      p_version: version,
      p_data: {
        name: parsed.data.name,
        product_type: parsed.data.productType,
        category: parsed.data.category,
        manufacturer_name: parsed.data.manufacturerName,
        model: parsed.data.model,
        description: parsed.data.description,
      },
      p_compatibility: compatibility.rows,
      p_sources: sources.rows,
    });
    if (error) return failure(error, values);
  } catch (error) {
    return failure(error, values);
  }
  refresh();
  return { status: "success", message: productId ? "Izdelek je shranjen." : "Izdelek je dodan kot osnutek." };
}

export async function setProductStatusAction(
  organizationId: string,
  productId: string,
  version: number,
  status: string,
): Promise<ActionState> {
  if (!isUuid(productId) || !isOneOf(productStatuses, status)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "catalog.manage");
    const { data, error } = await supabase
      .from("catalog_products")
      .update({ status })
      .eq("supplier_organization_id", organizationId)
      .eq("id", productId)
      .eq("version", version)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return { status: "error", message: "Izdelka ni bilo mogoče posodobiti. Osvežite stran." };
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Stanje izdelka je posodobljeno." };
}

export async function savePrivateNoteAction(
  organizationId: string,
  productId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = String(formData.get("body") ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (body.length > 4000) return { status: "error", fieldErrors: { body: "Največ 4000 znakov." }, values: { body } };
  if (!isUuid(productId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "recommendations.feedback");
    if (!body) {
      const { error } = await supabase
        .from("catalog_private_notes")
        .delete()
        .eq("organization_id", organizationId)
        .eq("product_id", productId);
      if (error) return failure(error);
    } else {
      const updated = await supabase
        .from("catalog_private_notes")
        .update({ body })
        .eq("organization_id", organizationId)
        .eq("product_id", productId)
        .select("product_id");
      if (updated.error) return failure(updated.error);
      if (!updated.data?.length) {
        const { error } = await supabase
          .from("catalog_private_notes")
          .insert({ organization_id: organizationId, product_id: productId, body });
        if (error) return failure(error);
      }
    }
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: body ? "Zapisek je shranjen." : "Zapisek je izbrisan." };
}

type FeedbackStatus = "saved" | "dismissed" | "info_requested" | "reviewed";

async function writeFeedback(
  organizationId: string,
  productId: string,
  ruleKey: string,
  status: FeedbackStatus | null,
) {
  const { supabase } = await requireOrgPermission(organizationId, "recommendations.feedback");
  if (status === null) {
    const { error } = await supabase
      .from("recommendation_feedback")
      .delete()
      .eq("organization_id", organizationId)
      .eq("product_id", productId)
      .eq("rule_key", ruleKey);
    if (error) throw error;
    return;
  }
  const updated = await supabase
    .from("recommendation_feedback")
    .update({ status })
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .eq("rule_key", ruleKey)
    .select("product_id");
  if (updated.error) throw updated.error;
  if (!updated.data?.length) {
    const { error } = await supabase
      .from("recommendation_feedback")
      .insert({ organization_id: organizationId, product_id: productId, rule_key: ruleKey, status });
    if (error) throw error;
  }
}

export async function setFeedbackAction(
  organizationId: string,
  productId: string,
  ruleKey: string,
  status: "saved" | "dismissed" | "reviewed" | null,
): Promise<ActionState> {
  if (!isUuid(productId) || !RULE_KEY.test(ruleKey)) return FORBIDDEN;
  try {
    await writeFeedback(organizationId, productId, ruleKey, status);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Shranjeno." };
}

export async function createInquiryAction(
  organizationId: string,
  product: { id: string; supplierId: string; ruleKey: string | null },
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["message"]);
  const parsed = inquirySchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  const equipmentIds = formData.getAll("equipmentIds").map(String).filter(isUuid).slice(0, 20);
  const shareContact = formData.get("shareContact") === "on";
  if (!isUuid(product.id) || !isUuid(product.supplierId)) return FORBIDDEN;
  try {
    const { supabase, organization, user } = await requireOrgPermission(organizationId, "supplier.inquire");
    let equipment: { name: string; category: string; manufacturer_name: string | null; model: string | null }[] = [];
    if (equipmentIds.length) {
      const { data, error } = await supabase
        .from("equipment")
        .select("name, category, manufacturer_name, model")
        .eq("organization_id", organizationId)
        .in("id", equipmentIds);
      if (error) return failure(error, values);
      equipment = data ?? [];
    }
    const [productRow, suppliers] = await Promise.all([
      supabase
        .from("catalog_products")
        .select("name")
        .eq("id", product.id)
        .eq("supplier_organization_id", product.supplierId)
        .eq("status", "published")
        .maybeSingle(),
      supabase.rpc("catalog_suppliers"),
    ]);
    if (productRow.error) return failure(productRow.error, values);
    if (!productRow.data) return { status: "error", message: "Izdelek ni (več) objavljen.", values };
    const supplierName =
      ((suppliers.data ?? []) as { organization_id: string; name: string }[]).find(
        (s) => s.organization_id === product.supplierId,
      )?.name ?? null;
    let contactName: string | null = null;
    if (shareContact) {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      contactName = (data?.full_name as string | null) ?? null;
    }
    // Only what the user explicitly chose is shared with the supplier.
    const snapshot = {
      product_name: productRow.data.name as string,
      supplier_name: supplierName,
      organization_name: organization.name,
      contact_name: shareContact ? contactName : null,
      contact_email: shareContact ? user.email : null,
      equipment,
    };
    const { error } = await supabase.from("supplier_inquiries").insert({
      organization_id: organizationId,
      supplier_organization_id: product.supplierId,
      product_id: product.id,
      message: parsed.data.message,
      shared_snapshot: snapshot,
    });
    if (error) return failure(error, values);
    if (product.ruleKey && RULE_KEY.test(product.ruleKey)) {
      await writeFeedback(organizationId, product.id, product.ruleKey, "info_requested");
    }
  } catch (error) {
    return failure(error, values);
  }
  after(sendPendingEmailsQuietly);
  refresh();
  return { status: "success", message: "Povpraševanje je poslano dobavitelju." };
}

export async function answerInquiryAction(
  organizationId: string,
  inquiryId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const response = String(formData.get("response") ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (response.length < 1 || response.length > 4000) {
    return {
      status: "error",
      fieldErrors: { response: "Vpišite odgovor (največ 4000 znakov)." },
      values: { response },
    };
  }
  if (!isUuid(inquiryId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "catalog.manage");
    const { data, error } = await supabase
      .from("supplier_inquiries")
      .update({ status: "answered", response_text: response })
      .eq("supplier_organization_id", organizationId)
      .eq("id", inquiryId)
      .select("id");
    if (error) return failure(error, { response });
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error, { response });
  }
  after(sendPendingEmailsQuietly);
  refresh();
  return { status: "success", message: "Odgovor je poslan." };
}

export async function closeInquiryAction(organizationId: string, inquiryId: string): Promise<ActionState> {
  if (!isUuid(inquiryId)) return FORBIDDEN;
  try {
    const { supabase } = await requireOrgPermission(organizationId, "supplier.inquire");
    const { data, error } = await supabase
      .from("supplier_inquiries")
      .update({ status: "closed" })
      .eq("organization_id", organizationId)
      .eq("id", inquiryId)
      .select("id");
    if (error) return failure(error);
    if (!data?.length) return FORBIDDEN;
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { status: "success", message: "Povpraševanje je zaprto." };
}
