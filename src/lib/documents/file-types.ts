/**
 * Accepted document formats. The declared type must match the file
 * extension, and after upload the stored bytes must match the format's
 * signature ("magic bytes"); otherwise the upload is rejected and deleted.
 */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const DOCUMENTS_BUCKET = "documents";

interface FileType {
  label: string;
  extensions: string[];
  matches: (head: Uint8Array) => boolean;
}

const startsWith = (head: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => head[offset + index] === byte);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const ZIP = [0x50, 0x4b, 0x03, 0x04];

export const fileTypes = {
  "application/pdf": { label: "PDF", extensions: ["pdf"], matches: (h) => startsWith(h, ascii("%PDF-")) },
  "image/jpeg": { label: "JPEG", extensions: ["jpg", "jpeg"], matches: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
  "image/png": {
    label: "PNG",
    extensions: ["png"],
    matches: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  "image/webp": {
    label: "WebP",
    extensions: ["webp"],
    matches: (h) => startsWith(h, ascii("RIFF")) && startsWith(h, ascii("WEBP"), 8),
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    label: "Word (DOCX)",
    extensions: ["docx"],
    matches: (h) => startsWith(h, ZIP),
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    label: "Excel (XLSX)",
    extensions: ["xlsx"],
    matches: (h) => startsWith(h, ZIP),
  },
} satisfies Record<string, FileType>;

export type DocumentMime = keyof typeof fileTypes;

export const acceptedExtensions = Object.values(fileTypes).flatMap((t) => t.extensions.map((e) => `.${e}`));

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return match ? match[1]!.toLowerCase() : "";
}

/** Resolves the MIME type from the browser-reported type and the extension; null when not accepted. */
export function resolveMime(fileName: string, reportedType: string): DocumentMime | null {
  const extension = extensionOf(fileName);
  const byExtension = (Object.keys(fileTypes) as DocumentMime[]).find((mime) =>
    (fileTypes[mime].extensions as string[]).includes(extension),
  );
  if (!byExtension) return null;
  if (reportedType && reportedType !== byExtension && reportedType !== "application/octet-stream") return null;
  return byExtension;
}

export function matchesSignature(mime: DocumentMime, head: Uint8Array): boolean {
  return fileTypes[mime].matches(head);
}

/** Display-safe file name: no path separators or control characters, at most 200 characters. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 200) return cleaned || "dokument";
  const extension = extensionOf(cleaned);
  return `${cleaned.slice(0, 190 - extension.length)}….${extension}`;
}

export const documentTypes = [
  "instructions_for_use",
  "service_report",
  "calibration_report",
  "inspection_report",
  "warranty_certificate",
  "acceptance_record",
  "declaration_of_conformity",
  "technical_datasheet",
  "service_contract",
  "other",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels: Record<DocumentType, string> = {
  instructions_for_use: "Navodila za uporabo",
  service_report: "Servisno poročilo",
  calibration_report: "Kalibracijsko poročilo",
  inspection_report: "Poročilo o pregledu",
  warranty_certificate: "Garancijski list",
  acceptance_record: "Prevzemni zapisnik",
  declaration_of_conformity: "Izjava o skladnosti",
  technical_datasheet: "Tehnični list",
  service_contract: "Servisna pogodba",
  other: "Drugo",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("sl-SI", { maximumFractionDigits: 0 })} kB`;
  return `${(bytes / 1024 / 1024).toLocaleString("sl-SI", { maximumFractionDigits: 1 })} MB`;
}
