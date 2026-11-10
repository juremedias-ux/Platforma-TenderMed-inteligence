"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AuthorizationError, getSessionUser, getUserClient, isUuid } from "@/lib/auth/session";
import { getSupabasePublicConfig } from "@/lib/config/server-env";
import { dbErrorMessage, registerErrorMessages } from "@/lib/db/errors";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentTypes,
  matchesSignature,
  resolveMime,
  sanitizeFileName,
  type DocumentMime,
} from "@/lib/documents/file-types";
import type { ActionState } from "@/lib/forms/action-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

registerErrorMessages({
  TM_TOO_MANY_PENDING: "Imate preveč nedokončanih nalaganj. Poskusite znova čez nekaj časa.",
  TM_DOCUMENT_NOT_READY: "Dokument še ni pripravljen.",
  TM_DOCUMENT_NOT_PENDING: "Nalaganje je že zaključeno.",
});

const FORBIDDEN = { status: "error" as const, message: "Za to dejanje nimate dovoljenja." };
const NOT_CONFIGURED = {
  status: "error" as const,
  message: "Shranjevanje dokumentov ni konfigurirano (manjka strežniški ključ Supabase).",
};

const startSchema = z.object({
  organizationId: z.string().refine(isUuid),
  equipmentId: z.string().refine(isUuid).nullable(),
  requestId: z.string().refine(isUuid).nullable(),
  documentType: z.enum(documentTypes),
  title: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2).max(160)),
  fileName: z.string().min(1).max(500),
  reportedType: z.string().max(200),
  size: z.number().int().min(1),
  shared: z.boolean(),
});

export type StartUploadInput = z.input<typeof startSchema>;

export type StartUploadResult =
  | { status: "ok"; documentId: string; signedUrl: string; mime: DocumentMime; apiKey: string }
  | { status: "error"; message: string };

/**
 * Step 1: authorize, create the pending document row and return a signed
 * upload URL for its fixed storage path (valid for a limited time, single path).
 */
export async function startDocumentUploadAction(input: StartUploadInput): Promise<StartUploadResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success)
    return { status: "error", message: "Podatki o datoteki niso veljavni. Vpišite naslov (vsaj 2 znaka)." };
  const data = parsed.data;
  if (data.size > MAX_DOCUMENT_BYTES) return { status: "error", message: "Datoteka je večja od 20 MB." };
  const mime = resolveMime(data.fileName, data.reportedType);
  if (!mime) return { status: "error", message: "Ta vrsta datoteke ni podprta (PDF, JPEG, PNG, WebP, DOCX, XLSX)." };

  const adminClient = getSupabaseAdminClient();
  const publicConfig = getSupabasePublicConfig();
  if (!adminClient || !publicConfig) return NOT_CONFIGURED;

  try {
    if (!(await getSessionUser())) throw new AuthorizationError();
    const supabase = await getUserClient();
    const { data: rows, error } = await supabase.rpc("create_pending_document", {
      p_org: data.organizationId,
      p_equipment: data.equipmentId,
      p_request: data.requestId,
      p_type: data.documentType,
      p_title: data.title,
      p_file_name: sanitizeFileName(data.fileName),
      p_mime: mime,
      p_size: data.size,
      p_shared: data.shared,
    });
    if (error) return { status: "error", message: dbErrorMessage(error) };
    const row = (Array.isArray(rows) ? rows[0] : rows) as { document_id: string; storage_path: string } | undefined;
    if (!row) return { status: "error", message: "Nalaganja ni bilo mogoče začeti." };

    const signed = await adminClient.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(row.storage_path);
    if (signed.error || !signed.data) {
      await adminClient.rpc("finalize_document", { p_document: row.document_id, p_ok: false });
      return { status: "error", message: "Nalaganja ni bilo mogoče začeti. Poskusite znova." };
    }
    return {
      status: "ok",
      documentId: row.document_id,
      signedUrl: signed.data.signedUrl,
      mime,
      apiKey: publicConfig.publishableKey,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return FORBIDDEN;
    return { status: "error", message: dbErrorMessage(error) };
  }
}

/**
 * Step 2 (after the browser upload): verify the stored object with the
 * service role — it must exist, have the declared size and start with the
 * format's signature. Otherwise it is deleted and the document rejected.
 */
export async function finalizeDocumentUploadAction(documentId: string): Promise<ActionState> {
  if (!isUuid(documentId)) return FORBIDDEN;
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return NOT_CONFIGURED;
  const user = await getSessionUser();
  if (!user) return FORBIDDEN;

  const supabase = await getUserClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, storage_path, mime_type, size_bytes, status, created_by")
    .eq("id", documentId)
    .maybeSingle();
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!doc || doc.created_by !== user.id || doc.status !== "pending") return FORBIDDEN;

  const download = await adminClient.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (download.error || !download.data) {
    return { status: "error", message: "Datoteka ni bila prejeta. Poskusite jo naložiti znova." };
  }
  const blob = download.data;
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const valid = blob.size === Number(doc.size_bytes) && matchesSignature(doc.mime_type as DocumentMime, head);

  if (!valid) {
    await adminClient.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
    await adminClient.rpc("finalize_document", { p_document: doc.id, p_ok: false });
    return { status: "error", message: "Vsebina datoteke ne ustreza njeni vrsti. Datoteka je zavrnjena." };
  }
  const finalized = await adminClient.rpc("finalize_document", { p_document: doc.id, p_ok: true });
  if (finalized.error) return { status: "error", message: dbErrorMessage(finalized.error) };
  refresh();
  return { status: "success", message: "Dokument je naložen." };
}

/** Marks an unfinished upload as rejected (e.g. the browser upload failed). */
export async function abandonDocumentUploadAction(documentId: string): Promise<void> {
  if (!isUuid(documentId)) return;
  const adminClient = getSupabaseAdminClient();
  const user = await getSessionUser();
  if (!adminClient || !user) return;
  const supabase = await getUserClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, status, created_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.created_by !== user.id || doc.status !== "pending") return;
  await adminClient.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  await adminClient.rpc("finalize_document", { p_document: doc.id, p_ok: false });
}

export async function updateDocumentAction(
  documentId: string,
  version: number,
  changes: { shared?: boolean; archived?: boolean },
): Promise<ActionState> {
  if (!isUuid(documentId)) return FORBIDDEN;
  try {
    if (!(await getSessionUser())) throw new AuthorizationError();
    const supabase = await getUserClient();
    const update: Record<string, unknown> = {};
    if (changes.shared !== undefined) update.shared_with_assignees = changes.shared;
    if (changes.archived !== undefined) update.archived_at = changes.archived ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("documents")
      .update(update)
      .eq("id", documentId)
      .eq("version", version)
      .select("id");
    if (error) return { status: "error", message: dbErrorMessage(error) };
    if (!data?.length) return { status: "error", message: "Dokumenta ni bilo mogoče posodobiti. Osvežite stran." };
  } catch (error) {
    if (error instanceof AuthorizationError) return FORBIDDEN;
    return { status: "error", message: dbErrorMessage(error) };
  }
  refresh();
  return {
    status: "success",
    message: changes.archived ? "Dokument je arhiviran." : "Dokument je posodobljen.",
  };
}
