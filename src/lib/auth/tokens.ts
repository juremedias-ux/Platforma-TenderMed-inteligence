import { createHash, randomBytes } from "node:crypto";

/**
 * Invitation tokens: 32 random bytes (base64url, 43 characters). Only the
 * SHA-256 hash is stored; the token itself is shown once to the inviter (or
 * sent by e-mail) and never logged.
 */
export function createInvitationToken(): { token: string; hashHex: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hashHex: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** bytea literal accepted by PostgREST (`\x` + hex). */
export function byteaHex(hashHex: string): string {
  return `\\x${hashHex}`;
}
