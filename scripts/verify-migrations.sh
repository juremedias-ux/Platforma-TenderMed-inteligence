#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local PostgreSQL cluster with
# emulated Supabase roles (anon, authenticated, service_role) and Supabase-like
# default privileges, then runs supabase/tests/verify_inquiries.sql.
#
# Requirements: PostgreSQL server binaries (initdb, pg_ctl, psql) on PATH or
# under /usr/lib/postgresql/<version>/bin. PostgreSQL refuses to run as root;
# when run as root, the script uses the `postgres` system user.
#
# This is a local consistency check, not a substitute for testing against a
# real Supabase project (see README → "Verifying form persistence").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGPORT_VERIFY:-55432}"
RUN_AS=()

if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants broad default privileges on new objects in public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  "${PSQL[@]}" < "$migration"
done

"${PSQL[@]}" < "$ROOT/supabase/tests/verify_inquiries.sql"
