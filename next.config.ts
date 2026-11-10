import type { NextConfig } from "next";

/**
 * Security headers applied to every route.
 *
 * A full script-src Content Security Policy requires per-request nonces,
 * which would make every page dynamic. This release uses a restrictive
 * partial policy (no framing, no plugins, same-origin form targets) and
 * documents a nonce-based CSP as a launch hardening option in the README.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Private application and auth pages must never be stored by shared caches.
    const privateHeaders = [{ key: "Cache-Control", value: "private, no-store" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/app/:path*", headers: privateHeaders },
      { source: "/app", headers: privateHeaders },
      { source: "/prijava", headers: privateHeaders },
      { source: "/pozabljeno-geslo", headers: privateHeaders },
      { source: "/ponastavitev-gesla", headers: privateHeaders },
      { source: "/povabilo/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
