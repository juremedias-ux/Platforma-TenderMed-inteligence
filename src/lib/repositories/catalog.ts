import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialRelationship, ProductStatus, ProductType } from "@/lib/catalog/domain";
import { QueryError } from "./equipment";

export interface SupplierRow {
  organization_id: string;
  name: string;
  commercial_relationship: CommercialRelationship;
}

export interface ProductRow {
  id: string;
  supplier_organization_id: string;
  name: string;
  product_type: ProductType;
  category: string;
  manufacturer_name: string | null;
  model: string | null;
  description: string | null;
  status: ProductStatus;
  published_at: string | null;
  version: number;
  compatibility: { manufacturer_name: string; model: string }[];
  sources: { title: string; url: string; retrieved_on: string | null }[];
}

const PRODUCT_COLUMNS =
  "id, supplier_organization_id, name, product_type, category, manufacturer_name, model, description, status, published_at, version";

export async function listSuppliers(supabase: SupabaseClient): Promise<SupplierRow[]> {
  const { data, error } = await supabase.rpc("catalog_suppliers");
  if (error) throw new QueryError("suppliers", error.code);
  return (data ?? []) as SupplierRow[];
}

/** Products visible to the caller: published ones of approved suppliers, or the supplier's own (scope.supplierId). */
export async function listProducts(
  supabase: SupabaseClient,
  scope: { supplierId?: string; publishedOnly?: boolean; q?: string; category?: string | null; type?: string | null },
): Promise<ProductRow[]> {
  let query = supabase.from("catalog_products").select(PRODUCT_COLUMNS);
  if (scope.supplierId) query = query.eq("supplier_organization_id", scope.supplierId);
  if (scope.publishedOnly) query = query.eq("status", "published");
  if (scope.category) query = query.eq("category", scope.category);
  if (scope.type) query = query.eq("product_type", scope.type);
  if (scope.q) query = query.or(["name", "manufacturer_name", "model"].map((c) => `${c}.ilike.%${scope.q}%`).join(","));
  const { data, error } = await query.order("name").limit(500);
  if (error) throw new QueryError("products", error.code);
  const products = (data ?? []) as Omit<ProductRow, "compatibility" | "sources">[];
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);
  const [compat, sources] = await Promise.all([
    supabase.from("catalog_compatibility").select("product_id, manufacturer_name, model").in("product_id", ids),
    supabase.from("catalog_sources").select("product_id, title, url, retrieved_on").in("product_id", ids),
  ]);
  if (compat.error) throw new QueryError("compatibility", compat.error.code);
  if (sources.error) throw new QueryError("sources", sources.error.code);
  return products.map((p) => ({
    ...p,
    compatibility: (compat.data ?? [])
      .filter((c) => c.product_id === p.id)
      .map((c) => ({ manufacturer_name: c.manufacturer_name as string, model: c.model as string })),
    sources: (sources.data ?? [])
      .filter((s) => s.product_id === p.id)
      .map((s) => ({ title: s.title as string, url: s.url as string, retrieved_on: s.retrieved_on as string | null })),
  }));
}

export async function listPrivateNotes(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("catalog_private_notes")
    .select("product_id, body")
    .eq("organization_id", organizationId);
  if (error) throw new QueryError("private notes", error.code);
  return new Map((data ?? []).map((n) => [n.product_id as string, n.body as string]));
}

export async function listFeedback(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("recommendation_feedback")
    .select("product_id, rule_key, status")
    .eq("organization_id", organizationId);
  if (error) throw new QueryError("feedback", error.code);
  return new Map((data ?? []).map((f) => [`${f.product_id}|${f.rule_key}`, f.status as string]));
}

export interface InquiryRow {
  id: string;
  organization_id: string;
  supplier_organization_id: string;
  product_id: string;
  message: string;
  shared_snapshot: {
    product_name?: string;
    supplier_name?: string | null;
    organization_name?: string;
    contact_name?: string | null;
    contact_email?: string | null;
    equipment?: { name: string; category: string; manufacturer_name: string | null; model: string | null }[];
  };
  status: "sent" | "answered" | "closed";
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
}

export async function listInquiries(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("supplier_inquiries")
    .select(
      "id, organization_id, supplier_organization_id, product_id, message, shared_snapshot, status, response_text, responded_at, created_at",
    )
    .or(`organization_id.eq.${organizationId},supplier_organization_id.eq.${organizationId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new QueryError("inquiries", error.code);
  return (data ?? []) as InquiryRow[];
}

export async function getSupplierApproval(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("supplier_approvals")
    .select("status, commercial_relationship")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new QueryError("supplier approval", error.code);
  return data as { status: string; commercial_relationship: CommercialRelationship } | null;
}
