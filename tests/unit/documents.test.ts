import { describe, expect, it } from "vitest";
import { formatBytes, matchesSignature, resolveMime, sanitizeFileName } from "@/lib/documents/file-types";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe("document file types", () => {
  it("resolves the type from the extension and rejects mismatches", () => {
    expect(resolveMime("porocilo.PDF", "application/pdf")).toBe("application/pdf");
    expect(resolveMime("slika.jpeg", "")).toBe("image/jpeg");
    expect(resolveMime("tabela.xlsx", "application/octet-stream")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(resolveMime("porocilo.pdf", "image/png")).toBeNull();
    expect(resolveMime("skripta.exe", "application/x-msdownload")).toBeNull();
    expect(resolveMime("brez-koncnice", "application/pdf")).toBeNull();
    expect(resolveMime("stran.html", "text/html")).toBeNull();
  });

  it("checks magic bytes", () => {
    expect(matchesSignature("application/pdf", bytes("%PDF-1.7"))).toBe(true);
    expect(matchesSignature("application/pdf", bytes("<html>"))).toBe(false);
    expect(matchesSignature("image/png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(matchesSignature("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(matchesSignature("image/webp", bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe(true);
    expect(matchesSignature("image/webp", bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBe(false);
    expect(
      matchesSignature("application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes("PK", 3, 4)),
    ).toBe(true);
  });

  it("sanitizes file names for display", () => {
    expect(sanitizeFileName("C:\\Users\\x\\poročilo  2026.pdf")).toBe("poročilo 2026.pdf");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("a\u0000b\u001f.pdf")).toBe("ab.pdf");
    const long = sanitizeFileName(`${"x".repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it("formats sizes in Slovenian", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 kB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });
});
