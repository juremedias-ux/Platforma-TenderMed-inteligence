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

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

/**
 * URL and publishable (public) key for user-scoped clients. These clients act
 * with the signed-in user's session, so RLS applies to every query.
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted as the legacy name.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = readNonEmpty("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    readNonEmpty("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? readNonEmpty("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/** Secret used by the scheduler to call /api/cron/* (Vercel sends it as a bearer token). */
export function getCronSecret(): string | null {
  return readNonEmpty("CRON_SECRET");
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

export interface EmailConfig {
  apiKey: string;
  /** Verified sender, e.g. "TenderMed <obvestila@vasa-domena.si>". */
  from: string;
}

/** E-mail provider (Resend). Null until a sending domain is verified and both values are set. */
export function getEmailConfig(): EmailConfig | null {
  const apiKey = readNonEmpty("RESEND_API_KEY");
  const from = readNonEmpty("EMAIL_FROM");
  return apiKey && from ? { apiKey, from } : null;
}

/** Absolute origin for links in e-mails (NEXT_PUBLIC_SITE_URL, else the Vercel production domain). */
export function getPublicAppUrl(): string | null {
  const configured = readNonEmpty("NEXT_PUBLIC_SITE_URL");
  const candidate =
    configured ??
    (readNonEmpty("VERCEL_PROJECT_PRODUCTION_URL") ? `https://${readNonEmpty("VERCEL_PROJECT_PRODUCTION_URL")}` : null);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}
