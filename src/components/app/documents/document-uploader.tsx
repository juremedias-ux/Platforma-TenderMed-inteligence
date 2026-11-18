"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  abandonDocumentUploadAction,
  finalizeDocumentUploadAction,
  startDocumentUploadAction,
} from "@/app/app/document-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import {
  MAX_DOCUMENT_BYTES,
  acceptedExtensions,
  documentTypeLabels,
  documentTypes,
  formatBytes,
  type DocumentType,
} from "@/lib/documents/file-types";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number }
  | { kind: "verifying" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/** PUT to the signed upload URL with progress reporting (XMLHttpRequest exposes upload progress). */
function putWithProgress(url: string, file: File, mime: string, apiKey: string, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("apikey", apiKey);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}

export function DocumentUploader({
  organizationId,
  equipmentId = null,
  requestId = null,
  allowSharing = false,
  defaultType = "other",
}: {
  organizationId: string;
  equipmentId?: string | null;
  requestId?: string | null;
  allowSharing?: boolean;
  defaultType?: DocumentType;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const id = `upload-${requestId ?? equipmentId ?? "org"}`;
  const busy = phase.kind === "uploading" || phase.kind === "verifying";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setPhase({ kind: "error", message: "Izberite datoteko." });
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setPhase({ kind: "error", message: "Datoteka je večja od 20 MB." });
      return;
    }
    setPhase({ kind: "uploading", progress: 0 });
    const start = await startDocumentUploadAction({
      organizationId,
      equipmentId,
      requestId,
      documentType: String(form.get("documentType")) as DocumentType,
      title: String(form.get("title") ?? "") || file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      reportedType: file.type,
      size: file.size,
      shared: form.get("shared") === "on",
    });
    if (start.status === "error") {
      setPhase({ kind: "error", message: start.message });
      return;
    }
    try {
      await putWithProgress(start.signedUrl, file, start.mime, start.apiKey, (progress) =>
        setPhase({ kind: "uploading", progress }),
      );
    } catch {
      await abandonDocumentUploadAction(start.documentId);
      setPhase({ kind: "error", message: "Nalaganje ni uspelo. Preverite povezavo in poskusite znova." });
      return;
    }
    setPhase({ kind: "verifying" });
    const result = await finalizeDocumentUploadAction(start.documentId);
    if (result.status === "success") {
      formRef.current?.reset();
      setPhase({ kind: "done", message: result.message ?? "Dokument je naložen." });
    } else {
      setPhase({ kind: "error", message: result.message ?? "Dokument ni bil sprejet." });
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-file`}>
            Datoteka (PDF, JPEG, PNG, WebP, DOCX, XLSX; največ {formatBytes(MAX_DOCUMENT_BYTES)})
          </Label>
          <Input
            id={`${id}-file`}
            name="file"
            type="file"
            accept={acceptedExtensions.join(",")}
            required
            disabled={busy}
            className="mt-1.5 h-auto py-2.5"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-title`}>Naslov</Label>
          <Input
            id={`${id}-title`}
            name="title"
            maxLength={160}
            placeholder="Privzeto ime datoteke"
            disabled={busy}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-type`}>Vrsta dokumenta</Label>
          <Select
            id={`${id}-type`}
            name="documentType"
            defaultValue={defaultType}
            disabled={busy}
            className="mt-1.5 h-11"
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabels[type]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {allowSharing ? (
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="shared"
            className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
            disabled={busy}
          />
          Deli z zunanjim serviserjem tega zahtevka
        </label>
      ) : null}
      {phase.kind === "uploading" ? (
        <div>
          <progress max={100} value={phase.progress} className="h-2 w-full" aria-label="Napredek nalaganja" />
          <p className="mt-1 text-xs text-ink-muted" aria-live="polite">
            Nalagam … {phase.progress} %
          </p>
        </div>
      ) : null}
      {phase.kind === "verifying" ? (
        <p className="text-sm text-ink-muted" role="status">
          Preverjam datoteko …
        </p>
      ) : null}
      {phase.kind === "done" ? (
        <p className="text-sm text-success-700" role="status">
          {phase.message}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p className="text-sm text-danger-700" role="alert">
          {phase.message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={busy}>
        <Upload aria-hidden="true" />
        Naloži dokument
      </Button>
    </form>
  );
}
