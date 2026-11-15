#!/usr/bin/env node
/**
 * Operator command: approves (or suspends) a supplier organization so that
 * its owners and admins can publish catalog products. Run explicitly by the
 * platform operator; there is no public endpoint for this.
 *
 *   node --env-file=.env.local scripts/approve-supplier.mjs \
 *     --organization-id <uuid> --status approved \
 *     --relationship none_declared --note "Pogodba z dne …"
 *
 * --status        approved | suspended
 * --relationship  none_declared | platform_operator_distributes | partner_listing | sponsored
 *                 (shown to users next to every product of the supplier)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const STATUSES = ["approved", "suspended"];
const RELATIONSHIPS = ["none_declared", "platform_operator_distributes", "partner_listing", "sponsored"];
const SUPPLIER_KINDS = ["distributor", "service_provider", "manufacturer"];

function fail(message) {
  console.error(`Napaka: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    "organization-id": { type: "string" },
    status: { type: "string", default: "approved" },
    relationship: { type: "string", default: "none_declared" },
    note: { type: "string" },
  },
});

const organizationId = values["organization-id"]?.trim();
if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) fail("podajte veljaven --organization-id.");
if (!STATUSES.includes(values.status)) fail(`--status mora biti eden od: ${STATUSES.join(", ")}.`);
if (!RELATIONSHIPS.includes(values.relationship))
  fail(`--relationship mora biti eden od: ${RELATIONSHIPS.join(", ")}.`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !secret) fail("v okolju manjkata NEXT_PUBLIC_SUPABASE_URL in SUPABASE_SECRET_KEY.");

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: organization, error: orgError } = await supabase
  .from("organizations")
  .select("id, name, kind")
  .eq("id", organizationId)
  .maybeSingle();
if (orgError) fail(`branje organizacije ni uspelo (${orgError.code ?? "neznana koda"}).`);
if (!organization) fail("organizacija ne obstaja.");
if (!SUPPLIER_KINDS.includes(organization.kind)) {
  fail(`organizacija je vrste "${organization.kind}"; dobavitelj mora biti distributer, serviser ali proizvajalec.`);
}

const { error } = await supabase.from("supplier_approvals").upsert(
  {
    organization_id: organizationId,
    status: values.status,
    commercial_relationship: values.relationship,
    note: values.note?.trim() || null,
    approved_at: new Date().toISOString(),
  },
  { onConflict: "organization_id" },
);
if (error) fail(`zapis ni uspel (${error.code ?? "neznana koda"}).`);

console.log(
  values.status === "approved"
    ? `Dobavitelj "${organization.name}" je odobren (komercialni odnos: ${values.relationship}).`
    : `Dobavitelj "${organization.name}" je začasno onemogočen; njegovi izdelki niso več vidni.`,
);
