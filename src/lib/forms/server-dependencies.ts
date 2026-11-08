import "server-only";

import { getExtraAllowedOrigins, getRateLimitHashSecret, getTurnstileSecret } from "@/lib/config/server-env";
import { getSupabaseInquiryBackend } from "@/lib/repositories/supabase-inquiry-repository";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import type { InquiryHandlerDependencies } from "./handle-inquiry";

/** Production wiring for the inquiry route handlers. */
export const inquiryServerDependencies: InquiryHandlerDependencies = {
  getBackend: getSupabaseInquiryBackend,
  getHashSecret: getRateLimitHashSecret,
  getTurnstileSecret,
  verifyTurnstile: (secret, token, ip) => verifyTurnstileToken(secret, token, ip),
  getExtraAllowedOrigins,
};
