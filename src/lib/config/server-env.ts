import "server-only";

/**
 * Server-only environment access. Privileged values are read here and must
 * never be exposed through `NEXT_PUBLIC_*` variables or client components.
 */

export interface SupabaseServerConfig {
  url: string;
  secretKey: string;
}

function readNonEmpty(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Returns null when Supabase is not configured; callers must handle that honestly. */
export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = readNonEmpty("NEXT_PUBLIC_SUPABASE_URL");
  // SUPABASE_SECRET_KEY (sb_secret_…) is preferred. SUPABASE_SERVICE_ROLE_KEY is
  // accepted only as a fallback for projects still on legacy JWT keys.
  const secretKey = readNonEmpty("SUPABASE_SECRET_KEY") ?? readNonEmpty("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secretKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }
  return { url, secretKey };
}

export function getTurnstileSecret(): string | null {
  return readNonEmpty("TURNSTILE_SECRET_KEY");
}

/**
 * Key used to pseudonymize IP addresses and e-mail addresses for rate
 * limiting. Falls back to the Supabase secret so no extra variable is
 * required; set RATE_LIMIT_HASH_SECRET to rotate it independently.
 */
export function getRateLimitHashSecret(): string | null {
  return readNonEmpty("RATE_LIMIT_HASH_SECRET") ?? getSupabaseServerConfig()?.secretKey ?? null;
}

/** Additional origins allowed to submit forms (comma-separated), e.g. a preview domain. */
export function getExtraAllowedOrigins(): string[] {
  const origins = [process.env.NEXT_PUBLIC_SITE_URL, ...(process.env.FORM_ALLOWED_ORIGINS ?? "").split(",")];
  return origins
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}
