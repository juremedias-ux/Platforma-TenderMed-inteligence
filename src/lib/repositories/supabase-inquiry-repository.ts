import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  PersistenceError,
  type ContactMessageRecord,
  type DemoRequestRecord,
  type InquiryRepository,
  type RateLimiter,
} from "./inquiry-repository";

/**
 * Supabase implementations. All writes go through SECURITY INVOKER
 * PostgreSQL functions that only the service role may execute (see
 * supabase/migrations). Errors are mapped to PersistenceError without
 * including submitted personal data.
 */

function createRepository(client: SupabaseClient): InquiryRepository {
  return {
    async saveDemoRequest(record: DemoRequestRecord) {
      const { error } = await client.rpc("submit_demo_request", {
        p_full_name: record.fullName,
        p_email: record.email,
        p_interest_area: record.interestArea,
        p_message: record.message,
        p_marketing_opt_in: record.marketingOptIn,
        p_consent_version: record.consentVersion,
        p_privacy_notice_version: record.privacyNoticeVersion,
        p_source: record.source,
      });
      if (error) throw new PersistenceError("demo request insert failed", error.code);
    },

    async saveContactMessage(record: ContactMessageRecord) {
      const { error } = await client.from("contact_messages").insert({
        full_name: record.fullName,
        email: record.email,
        message: record.message,
        privacy_notice_version: record.privacyNoticeVersion,
        source: record.source,
      });
      if (error) throw new PersistenceError("contact message insert failed", error.code);
    },
  };
}

function createRateLimiter(client: SupabaseClient): RateLimiter {
  return {
    async consume(bucket, keyHash, limit, windowSeconds) {
      const { data, error } = await client.rpc("consume_form_rate_limit", {
        p_bucket: bucket,
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new PersistenceError("rate limit check failed", error.code);
      return data === true;
    },
  };
}

export interface InquiryBackend {
  repository: InquiryRepository;
  rateLimiter: RateLimiter;
}

/** Null when Supabase is not configured. */
export function getSupabaseInquiryBackend(): InquiryBackend | null {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  return { repository: createRepository(client), rateLimiter: createRateLimiter(client) };
}
