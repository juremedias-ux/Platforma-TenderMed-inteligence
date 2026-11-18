import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/config/server-env";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route
 * Handlers. It uses the publishable key plus the session cookie, so every
 * query runs as the signed-in user and RLS applies. Returns null when the
 * platform is not configured.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session on the next request.
        }
      },
    },
  });
}
