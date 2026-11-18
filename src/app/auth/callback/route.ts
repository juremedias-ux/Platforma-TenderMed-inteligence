import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

/**
 * Completes e-mail based auth flows (password recovery). Supports the PKCE
 * `code` parameter and the `token_hash` + `type` parameters used by custom
 * e-mail templates. Redirects only to same-site application paths.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const failure = NextResponse.redirect(new URL("/prijava?napaka=povezava", url.origin));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure;

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (tokenHash && type && ["recovery", "email", "invite", "magiclink", "signup"].includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return failure;
}
