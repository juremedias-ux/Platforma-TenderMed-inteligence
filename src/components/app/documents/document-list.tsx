import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/dates/datetime";
import { documentTypeLabels, formatBytes, documentTypes } from "@/lib/documents/file-types";
import { isOneOf } from "@/lib/equipment/domain";
import type { DocumentRow } from "@/lib/repositories/service";
import { DocumentRowActions } from "./document-row-actions";

export function DocumentList({
  documents,
  names,
  canManage,
  showSharing,
}: {
  documents: DocumentRow[];
  names: Map<string, string>;
  canManage: boolean;
  showSharing: boolean;
}) {
  if (documents.length === 0) return <p className="text-sm text-ink-muted">Ni dokumentov.</p>;
  return (
    <ul className="divide-y divide-line">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 gap-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <a
                href={`/app/dokumenti/${doc.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
                rel="noopener"
              >
                {doc.title}
              </a>
              <p className="text-xs text-ink-muted">
                {isOneOf(documentTypes, doc.document_type) ? documentTypeLabels[doc.document_type] : doc.document_type}{" "}
                · {doc.file_name} · {formatBytes(Number(doc.size_bytes))} ·{" "}
                {doc.created_by ? (names.get(doc.created_by) ?? "nekdanji udeleženec") : "sistem"},{" "}
                {formatDateTime(doc.created_at)}
                {doc.uploaded_as === "assignee" ? " · naložil zunanji serviser" : ""}
                {showSharing && doc.service_request_id
                  ? doc.shared_with_assignees
                    ? " · deljeno s serviserjem"
                    : " · interno"
                  : ""}
              </p>
            </div>
          </div>
          {canManage ? (
            <DocumentRowActions
              documentId={doc.id}
              version={doc.version}
              shared={doc.shared_with_assignees}
              canShare={showSharing && Boolean(doc.service_request_id) && doc.uploaded_as === "member"}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
