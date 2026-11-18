/** Pure helpers shared by the data access layer and tests. */

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Post-login destinations are restricted to same-site application paths, so a
 * crafted `?next=` cannot redirect users to another site.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/app";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/app";
  }
  const allowed =
    value === "/app" || value.startsWith("/app/") || value.startsWith("/povabilo/") || value === "/ponastavitev-gesla";
  return allowed ? value : "/app";
}
