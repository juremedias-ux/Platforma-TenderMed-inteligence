import "server-only";

import { headers } from "next/headers";
import { getRateLimitHashSecret } from "@/lib/config/server-env";
import { siteConfig } from "@/lib/config/site";
import { getSupabaseInquiryBackend } from "@/lib/repositories/supabase-inquiry-repository";
import { hashIdentifier } from "./request-guards";

/** Client IP for rate limiting inside Server Actions (trusted on Vercel). */
export async function getActionClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

/** Origin used in links (configured canonical URL first, then the request host). */
export async function getAppOrigin(): Promise<string> {
  if (siteConfig.url) return siteConfig.url;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Durable rate limit shared with the public forms (form_rate_limits table).
 * Returns true when the attempt is allowed. When the backend is not configured
 * the platform cannot authenticate anyway, so the check is skipped.
 */
export async function allowAttempt(bucket: string, key: string, limit: number, windowSeconds: number) {
  const backend = getSupabaseInquiryBackend();
  const secret = getRateLimitHashSecret();
  if (!backend || !secret) return true;
  try {
    return await backend.rateLimiter.consume(bucket, hashIdentifier(secret, bucket, key), limit, windowSeconds);
  } catch {
    console.error(`[rate-limit] check failed for ${bucket}`);
    return false;
  }
}
