#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local PostgreSQL cluster with an
# emulation of the Supabase roles, default privileges and auth/storage schemas
# (supabase/tests/support/supabase-emulation.sql), then runs the SQL checks in
# supabase/tests/verify_inquiries.sql.
#
# This is a local consistency check, not a substitute for testing against a
# real Supabase project.
set -euo pipefail
source "$(dirname "$0")/lib-pg-cluster.sh"
trap pg_cluster_stop EXIT

pg_cluster_start
pg_apply_migrations
"${PSQL[@]}" < "$ROOT/supabase/tests/verify_inquiries.sql"
