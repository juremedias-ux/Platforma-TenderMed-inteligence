#!/usr/bin/env bash
# Shared helpers: start a throwaway PostgreSQL cluster and apply the Supabase
# emulation plus all migrations. Sourced by verify-migrations.sh and test-db.sh.
#
# Requirements: PostgreSQL server binaries (initdb, pg_ctl, psql) on PATH or
# under /usr/lib/postgresql/<version>/bin. PostgreSQL refuses to run as root;
# when run as root, the cluster runs as the `postgres` system user.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
PG_WORK="$(mktemp -d)"
PG_PORT="${PGPORT_TEST:-55432}"
RUN_AS=()

if [ "$(id -u)" = "0" ]; then
  chown postgres "$PG_WORK"
  RUN_AS=(runuser -u postgres --)
fi

pg_cluster_stop() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$PG_WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$PG_WORK"
}

pg_cluster_start() {
  "${RUN_AS[@]}" "$PG_BIN/initdb" -D "$PG_WORK/data" -U postgres --auth=trust >/dev/null
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$PG_WORK/data" \
    -o "-p $PG_PORT -k $PG_WORK -c listen_addresses=127.0.0.1 -c timezone=UTC" \
    -l "$PG_WORK/log" start >/dev/null
  PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$PG_WORK" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
}

pg_apply_migrations() {
  "${PSQL[@]}" < "$ROOT/supabase/tests/support/supabase-emulation.sql"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    echo "Applying $(basename "$migration")"
    "${PSQL[@]}" < "$migration"
  done
}
