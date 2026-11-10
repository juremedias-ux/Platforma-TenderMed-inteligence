# Implementation progress

Updated at the end of every phase. Status values: **implemented and tested**, **implemented, awaiting
configuration**, **partially implemented**, **planned**.

## Phase 0 — Baseline (done)

- Branch restarted from `origin/main` (PR #1 merged).
- Baseline on `main` (`461e1b6`): lint, typecheck, Prettier, 72 unit tests, migration verification,
  51 e2e tests (15 viewport-specific skips), production build, `npm audit --omit=dev` (0) — all passed.
- Local Supabase (Docker) is not available in the build environment (image downloads blocked). Database and
  RLS tests run on a throwaway PostgreSQL 16 cluster with an emulation of the Supabase `auth`/`storage`
  schemas and the real `anon`/`authenticated`/`service_role` roles (`npm run test:db`).
- Added dependencies: `@supabase/ssr` (runtime), `pg` + `@types/pg` (tests).
