import { getSessionUser, getUserClient, isUuid } from "@/lib/auth/session";
import { DOCUMENTS_BUCKET } from "@/lib/documents/file-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Document download. Access is checked by reading the document row with the
 * caller's session (RLS); only then a signed URL valid for 60 seconds is
 * issued and the browser is redirected to it. Nothing is cached.
 */
export async function GET(_request: Request, { params }: RouteContext<"/app/dokumenti/[documentId]">) {
  const { documentId } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!isUuid(documentId)) return new Response("Dokument ne obstaja.", { status: 404, headers });
  const adminClient = getSupabaseAdminClient();
  const user = await getSessionUser();
  if (!adminClient || !user) return new Response("Dostop ni dovoljen.", { status: 403, headers });

  const supabase = await getUserClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("storage_path, file_name, status")
    .eq("id", documentId)
    .eq("status", "ready")
    .maybeSingle();
  if (error) return new Response("Dokumenta ni bilo mogoče naložiti.", { status: 500, headers });
  if (!doc) return new Response("Dokument ne obstaja ali do njega nimate dostopa.", { status: 404, headers });

  const signed = await adminClient.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (signed.error || !signed.data) return new Response("Prenos trenutno ni mogoč.", { status: 502, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: signed.data.signedUrl } });
}
