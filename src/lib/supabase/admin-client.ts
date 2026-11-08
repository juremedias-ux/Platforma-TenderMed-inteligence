import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/config/server-env";

/**
 * Privileged Supabase client for trusted server code only.
 *
 * It uses the project's secret key, which bypasses row-level security. It
 * must never be imported into client components; the `server-only` import
 * makes such an import fail at build time. Sessions are disabled because
 * this client never acts on behalf of a signed-in user.
 */
let cachedClient: SupabaseClient | null = null;
let cachedKey: string | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = getSupabaseServerConfig();
  if (!config) return null;

  const cacheKey = `${config.url}|${config.secretKey}`;
  if (cachedClient && cachedKey === cacheKey) return cachedClient;

  cachedClient = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "tendermed-website" } },
  });
  cachedKey = cacheKey;
  return cachedClient;
}
