#!/usr/bin/env node
/**
 * Operator command: provisions an organization and an invitation for its
 * first owner. Run explicitly by the platform operator; there is no public
 * endpoint for this.
 *
 *   node --env-file=.env.local scripts/bootstrap-organization.mjs \
 *     --name "Ime organizacije" --kind healthcare_provider --owner-email lastnik@example.si
 *
 * Kinds: healthcare_provider | distributor | service_provider | manufacturer
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment
 * (never pass secrets as arguments). The invitation link is printed once; the
 * token is not stored anywhere except as a SHA-256 hash in the database.
 * Safe to rerun: an existing owner is reported; a pending owner invitation
 * for the same e-mail is revoked and replaced. No account or password is
 * created — the owner sets a password when accepting the invitation.
 */
import { createHash, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const KINDS = ["healthcare_provider", "distributor", "service_provider", "manufacturer"];

function fail(message) {
  console.error(`Napaka: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    kind: { type: "string" },
    "owner-email": { type: "string" },
    "site-url": { type: "string" },
  },
});

const name = values.name?.trim();
const kind = values.kind?.trim();
const ownerEmail = values["owner-email"]?.trim().toLowerCase();
const siteUrl = (values["site-url"] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");

if (!name || name.length < 2) fail("podajte --name (vsaj 2 znaka).");
if (!kind || !KINDS.includes(kind)) fail(`--kind mora biti eden od: ${KINDS.join(", ")}.`);
if (!ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) fail("podajte veljaven --owner-email.");
if (!siteUrl || !/^https?:\/\//.test(siteUrl))
  fail(
    "podajte --site-url (npr. https://platforma-tender-med-inteligence.vercel.app) ali nastavite NEXT_PUBLIC_SITE_URL.",
  );

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !secret) fail("v okolju manjkata NEXT_PUBLIC_SUPABASE_URL in SUPABASE_SECRET_KEY.");

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("bootstrap_organization", {
  p_name: name,
  p_kind: kind,
  p_owner_email: ownerEmail,
  p_token_hash: `\\x${tokenHash}`,
});

if (error) {
  const code = /TM_[A-Z_]+/.exec(error.message)?.[0];
  if (code === "TM_BOOTSTRAP_AMBIGUOUS") fail("obstaja več organizacij s tem imenom; uredite ime v bazi.");
  if (code === "TM_BOOTSTRAP_KIND_MISMATCH") fail("organizacija s tem imenom že obstaja z drugo vrsto.");
  fail(`klic ni uspel (${error.code ?? "neznana koda"}). Ali so migracije uveljavljene?`);
}

const row = Array.isArray(data) ? data[0] : data;
if (row?.status === "already_owner") {
  console.log(`Organizacija "${name}" že ima lastnika ${ownerEmail}. Nič ni bilo spremenjeno.`);
  process.exit(0);
}

console.log(`Organizacija: ${name} (${row?.organization_id})`);
console.log(`Povabilo za lastnika ${ownerEmail} je ustvarjeno (velja 7 dni, enkratna uporaba).`);
console.log("Povezavo pošljite lastniku po zanesljivem kanalu in je ne objavljajte:");
console.log(`${siteUrl}/povabilo/${token}`);
