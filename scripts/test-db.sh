#!/usr/bin/env bash
# Database and row-level-security tests.
#
# Starts a throwaway PostgreSQL cluster, applies the Supabase emulation and all
# migrations, then runs tests/db/** with Vitest. Tests connect as the
# superuser only to create fixtures; every assertion about access runs as the
# `anon` or `authenticated` role with request.jwt.claims set, so RLS applies.
set -euo pipefail
source "$(dirname "$0")/lib-pg-cluster.sh"
trap pg_cluster_stop EXIT

pg_cluster_start
pg_apply_migrations >/dev/null

export DB_TEST_URL="postgresql://postgres@127.0.0.1:${PG_PORT}/postgres"
cd "$ROOT"
npx vitest run --config vitest.db.config.mts "$@"
