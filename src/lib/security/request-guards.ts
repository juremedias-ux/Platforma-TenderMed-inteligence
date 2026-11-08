import { createHmac } from "node:crypto";

/**
 * Request-level protections for public form endpoints. These are pure
 * helpers so they can be unit tested without a running server.
 */

export const MAX_FORM_BODY_BYTES = 16 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
}

export function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/**
 * Reads the body as text while enforcing a byte limit, independent of the
 * (client-controlled) Content-Length header.
 */
export async function readBodyWithLimit(request: Request, maxBytes = MAX_FORM_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Same-origin check for browser submissions. Browsers always send `Origin`
 * on cross-origin and same-origin POST requests made with fetch, so a
 * missing or foreign origin is rejected. This blocks cross-site form
 * posting; it is not an authentication mechanism (non-browser clients can
 * set any header), which is why rate limiting and validation also apply.
 */
export function isAllowedOrigin(request: Request, extraAllowedOrigins: string[] = []): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originValue: string;
  try {
    originValue = new URL(origin).origin;
  } catch {
    return false;
  }

  const allowed = new Set(extraAllowedOrigins);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || new URL(request.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  allowed.add(new URL(request.url).origin);

  return allowed.has(originValue);
}

/**
 * Client IP for rate limiting. On Vercel, `x-forwarded-for` is set by the
 * platform; the first entry is the client address. Elsewhere the value may
 * be client-controlled, so it is only used as a rate-limit key, never for
 * authorization.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Keyed hash so raw IP and e-mail addresses are never stored for rate limiting. */
export function hashIdentifier(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
