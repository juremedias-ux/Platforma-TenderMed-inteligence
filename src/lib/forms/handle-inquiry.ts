import type { z } from "zod";
import { siteConfig } from "@/lib/config/site";
import type { InquiryRepository, RateLimiter } from "@/lib/repositories/inquiry-repository";
import {
  BodyTooLargeError,
  getClientIp,
  hashIdentifier,
  isAllowedOrigin,
  isJsonContentType,
  readBodyWithLimit,
} from "@/lib/security/request-guards";
import {
  contactMessageSchema,
  demoRequestSchema,
  toFieldErrors,
  type ContactMessageData,
  type DemoRequestData,
} from "@/lib/validation/inquiry-schemas";
import { HONEYPOT_FIELD, type InquiryErrorCode, type InquiryResponseBody } from "./inquiry-response";

/**
 * Framework-independent handler for public inquiry submissions.
 *
 * Pipeline: content type → same origin → body size → JSON → honeypot →
 * validation → backend availability → optional Turnstile → durable rate
 * limit → persistence. A success response is returned only after the
 * repository confirms the write. Logs contain event codes only, never
 * submitted personal data.
 */

export interface InquiryHandlerDependencies {
  getBackend: () => { repository: InquiryRepository; rateLimiter: RateLimiter } | null;
  getHashSecret: () => string | null;
  getTurnstileSecret: () => string | null;
  verifyTurnstile: (secret: string, token: string, remoteIp: string | null) => Promise<boolean>;
  getExtraAllowedOrigins: () => string[];
  logger?: Pick<Console, "warn" | "error">;
}

interface RateLimitRule {
  bucket: string;
  key: "ip" | "email";
  limit: number;
  windowSeconds: number;
}

interface InquiryDefinition<TSchema extends z.ZodType> {
  kind: "demo_request" | "contact";
  schema: TSchema;
  rateLimits: RateLimitRule[];
  persist: (repository: InquiryRepository, data: z.output<TSchema>) => Promise<void>;
}

export const DEMO_REQUEST_SOURCE = "website:pilot";
export const CONTACT_SOURCE = "website:contact";

export const demoRequestDefinition: InquiryDefinition<typeof demoRequestSchema> = {
  kind: "demo_request",
  schema: demoRequestSchema,
  rateLimits: [
    { bucket: "demo_request:ip", key: "ip", limit: 5, windowSeconds: 600 },
    { bucket: "demo_request:email", key: "email", limit: 3, windowSeconds: 3600 },
  ],
  persist: (repository, data: DemoRequestData) =>
    repository.saveDemoRequest({
      fullName: data.fullName,
      email: data.email,
      interestArea: data.interestArea,
      message: data.message,
      marketingOptIn: data.marketingOptIn,
      consentVersion: data.marketingOptIn ? siteConfig.marketingConsentVersion : null,
      privacyNoticeVersion: siteConfig.privacyNoticeVersion,
      source: DEMO_REQUEST_SOURCE,
    }),
};

export const contactDefinition: InquiryDefinition<typeof contactMessageSchema> = {
  kind: "contact",
  schema: contactMessageSchema,
  rateLimits: [
    { bucket: "contact:ip", key: "ip", limit: 5, windowSeconds: 600 },
    { bucket: "contact:email", key: "email", limit: 5, windowSeconds: 3600 },
  ],
  persist: (repository, data: ContactMessageData) =>
    repository.saveContactMessage({
      fullName: data.fullName,
      email: data.email,
      message: data.message,
      privacyNoticeVersion: siteConfig.privacyNoticeVersion,
      source: CONTACT_SOURCE,
    }),
};

function json(body: InquiryResponseBody, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function fail(code: InquiryErrorCode, status: number, extra: Partial<InquiryResponseBody> = {}, headers = {}) {
  return json({ ok: false, code, ...extra } as InquiryResponseBody, status, headers);
}

export async function handleInquiry<TSchema extends z.ZodType>(
  request: Request,
  definition: InquiryDefinition<TSchema>,
  deps: InquiryHandlerDependencies,
): Promise<Response> {
  const log = deps.logger ?? console;

  if (!isJsonContentType(request)) return fail("invalid_content_type", 415);
  if (!isAllowedOrigin(request, deps.getExtraAllowedOrigins())) return fail("forbidden_origin", 403);

  let raw: string;
  try {
    raw = await readBodyWithLimit(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail("payload_too_large", 413);
    return fail("invalid_json", 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail("invalid_json", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return fail("invalid_json", 400);
  }

  const { [HONEYPOT_FIELD]: honeypot, turnstileToken, ...fields } = payload as Record<string, unknown>;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    log.warn(`[inquiry:${definition.kind}] rejected: honeypot`);
    return fail("rejected", 400);
  }

  const parsed = definition.schema.safeParse(fields);
  if (!parsed.success) {
    return fail("validation_failed", 422, { fieldErrors: toFieldErrors(parsed.error) });
  }
  const data = parsed.data as z.output<TSchema> & { email: string };

  const backend = deps.getBackend();
  const hashSecret = deps.getHashSecret();
  if (!backend || !hashSecret) {
    log.error(`[inquiry:${definition.kind}] unavailable: storage not configured`);
    return fail("unavailable", 503);
  }

  const ip = getClientIp(request);
  const turnstileSecret = deps.getTurnstileSecret();
  if (turnstileSecret) {
    const token = typeof turnstileToken === "string" ? turnstileToken : "";
    if (!(await deps.verifyTurnstile(turnstileSecret, token, ip))) {
      log.warn(`[inquiry:${definition.kind}] rejected: verification failed`);
      return fail("verification_failed", 400);
    }
  }

  try {
    for (const rule of definition.rateLimits) {
      const value = rule.key === "ip" ? ip : data.email;
      const allowed = await backend.rateLimiter.consume(
        rule.bucket,
        hashIdentifier(hashSecret, rule.bucket, value),
        rule.limit,
        rule.windowSeconds,
      );
      if (!allowed) {
        log.warn(`[inquiry:${definition.kind}] rate limited: ${rule.bucket}`);
        return fail("rate_limited", 429, {}, { "Retry-After": String(rule.windowSeconds) });
      }
    }
  } catch (error) {
    log.error(`[inquiry:${definition.kind}] rate limit check failed`, errorCode(error));
    return fail("persistence_failed", 500);
  }

  try {
    await definition.persist(backend.repository, data);
  } catch (error) {
    log.error(`[inquiry:${definition.kind}] persistence failed`, errorCode(error));
    return fail("persistence_failed", 500);
  }

  return json({ ok: true }, 201);
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "unknown";
}
