import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie for application and auth routes.
 *
 * This is NOT an authorization layer: every page, Server Action and Route
 * Handler verifies the user and permissions itself (src/lib/auth/session.ts),
 * and RLS enforces access in the database.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
      },
    },
  });

  // Verifies and, when needed, refreshes the session.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/prijava", "/pozabljeno-geslo", "/ponastavitev-gesla", "/povabilo/:path*", "/auth/:path*"],
};
