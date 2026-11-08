/**
 * Optional Cloudflare Turnstile verification. Used only when
 * TURNSTILE_SECRET_KEY is configured; otherwise the form relies on
 * validation, honeypot, origin check and durable rate limiting.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
