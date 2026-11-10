import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

/**
 * Database test helpers.
 *
 * The superuser connection is used ONLY to create fixtures (auth users,
 * organizations, memberships). Every access assertion runs through
 * `asUser()` / `asAnon()`, which switch to the `authenticated` / `anon`
 * role and set request.jwt.claims exactly like PostgREST, so RLS applies.
 */

const url = process.env.DB_TEST_URL;
if (!url) {
  throw new Error("DB_TEST_URL is not set. Run the database tests with `npm run test:db`.");
}

export const pool = new Pool({ connectionString: url, max: 6 });

export type Query = <R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<QueryResult<R>>;

/** Superuser query for fixtures. */
export const admin: Query = (text, params) => pool.query(text, params);

async function withRole<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (q: Query) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    const claims = userId ? { sub: userId, role } : { role };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn((text, params) => client.query(text, params));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const asUser = <T>(userId: string, fn: (q: Query) => Promise<T>) => withRole("authenticated", userId, fn);
export const asAnon = <T>(fn: (q: Query) => Promise<T>) => withRole("anon", null, fn);
export const asService = <T>(fn: (q: Query) => Promise<T>) => withRole("service_role", null, fn);

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
}

export async function createAuthUser(options: { email?: string; confirmed?: boolean; fullName?: string } = {}) {
  const email = options.email ?? uniqueEmail();
  const { rows } = await admin<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [
      email,
      options.confirmed === false ? null : new Date(),
      JSON.stringify({ full_name: options.fullName ?? "Test Oseba" }),
    ],
  );
  return { id: rows[0]!.id, email };
}

export async function createOrganization(name = `Org ${randomUUID().slice(0, 6)}`, kind = "healthcare_provider") {
  const { rows } = await admin<{ id: string }>(
    "insert into public.organizations (name, kind) values ($1, $2) returning id",
    [name, kind],
  );
  return rows[0]!.id;
}

export async function addMember(organizationId: string, userId: string, role: string) {
  await admin("insert into public.organization_memberships (organization_id, user_id, role) values ($1, $2, $3)", [
    organizationId,
    userId,
    role,
  ]);
}

export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest() };
}

/** Creates an organization with an owner, admin, equipment manager and viewer. */
export async function createTenant(kind = "healthcare_provider") {
  const organizationId = await createOrganization(undefined, kind);
  const owner = await createAuthUser({ email: uniqueEmail("owner") });
  const adminUser = await createAuthUser({ email: uniqueEmail("admin") });
  const manager = await createAuthUser({ email: uniqueEmail("manager") });
  const viewer = await createAuthUser({ email: uniqueEmail("viewer") });
  await addMember(organizationId, owner.id, "owner");
  await addMember(organizationId, adminUser.id, "admin");
  await addMember(organizationId, manager.id, "equipment_manager");
  await addMember(organizationId, viewer.id, "viewer");
  return { organizationId, owner, admin: adminUser, manager, viewer };
}

/** Expects a promise to reject; returns the Postgres error message. */
export async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the operation to be rejected, but it succeeded.");
}
