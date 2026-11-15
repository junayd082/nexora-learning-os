# NEXORA — Engineering Audit (Milestone 0)

**Date:** 2026-11-14 · **Release audited:** 1.5.3 (production deployment `dpl_BEsMykuWrw15Gt36KGvYZy3Lk8DV`, READY)
**Method:** read-only. Nothing was changed, deployed or pushed. Sources: local source tree (the same tree that produced the 1.5.3 deploy zip), Supabase project `vdrdfcodtccfvctdmmyq` (table list, security advisors, migration history, function definitions, storage metadata), Vercel deployment history, `npm audit`.

Legend: **Confirmed** = observed directly. **Suspected** = plausible risk, not yet proven.

---

## Critical

| # | Finding | Status | Evidence |
|---|---|---|---|
| C1 | **300 concurrent users can't pass on the Supabase Free plan.** The Realtime ceiling is 200 concurrent connections. NEXORA opens one socket per browser tab. | Confirmed (measured) | Ramp test: 200 healthy, 225 failed. 70% safe number: 140. Pro plan limit: 500. |
| C2 | **No backups or rollback point for the database.** The Free plan has no downloadable daily backups and no point-in-time recovery (PITR), and no `pg_dump` exists. Any schema or permission change is currently unrecoverable if it goes wrong. | Confirmed | Plan = Free. No dump in the project. |
| C3 | **CWOA shares the same database and the same `public` schema.** It has 3 tables (`cwoa_attendees`, `cwoa_answers`, `cwoa_settings`), 5 anon-callable RPCs, and 2 migrations. A blanket "revoke anon EXECUTE" would break the CWOA church site. A plan upgrade, pause or restore also affects CWOA. | Confirmed | `list_tables`, migrations `cwoa_growth_track_event` and `cwoa_already_member_option`. |

## High

| # | Finding | Status | Evidence |
|---|---|---|---|
| H1 | **No source control.** There's no git repo and no history. The only source of truth is a folder plus zip files. | Confirmed | `git rev-parse` fails. |
| H2 | **No validation gate on production.** `npm run deploy` = `vercel --prod` straight from a laptop, with no typecheck, lint, tests or preview step. | Confirmed | `package.json`. 8 consecutive production deploys and no previews. |
| H3 | **Zero automated tests, no CI.** There's no test runner, no ESLint config (`next lint` has nothing to run), no `.github/`. | Confirmed | Project tree. |
| H4 | **Migrations in the repo don't match the database.** The database has 24 applied migrations. The repo has 17 files, and these are missing: `0011_hand_position`, `0016_demo_live_class_seed`, `0017_attendance_demo_reset`, and the 2 CWOA migrations. The schema can't be rebuilt from the repo. | Confirmed | `list_migrations` vs `supabase/migrations/`. |
| H5 | **Every test so far ran against production.** There's no staging database. Load tests created real auth users in the live project (cleaned up afterwards). The prompt's own rules require isolated test infrastructure. | Confirmed | Previous session. |
| H6 | **The browser-side sign-up from 1.5.3 isn't proven on the real site.** It was verified only against a local fake auth server. The one-phone cellular test is still pending. "Confirm email" status since the 11:34 settings change is unknown. | Suspected | No production sign-up observed since the deploy. |
| H7 | **Vulnerable dependencies.** `jspdf` has a **critical** DoS advisory with a non-breaking fix available. `postcss` inside `next` has a **high** advisory, fixable only by upgrading to Next 16 (a major version; postcss runs at build time, so the runtime exposure is low). | Confirmed | `npm audit --omit=dev`: 1 critical, 1 high, 1 moderate. |

## Medium

| # | Finding | Status | Evidence |
|---|---|---|---|
| M1 | **`material_status(p_quiz, p_uid)` is anon-callable and has no caller check.** Anyone who knows a quiz UUID and a student UUID can learn whether that student submitted it or got it back. UUIDs are hard to guess, but this is still an authorization gap. | Confirmed | Function body. Listed by the advisor. |
| M2 | **Over-broad EXECUTE grants.** 20 SECURITY DEFINER functions are anon-callable and 54 are callable by authenticated users. I spot-checked `admin_*`, `regenerate_join_code` and `demo_live_reset`, and all of them guard internally (`is_platform_admin()` / teacher check). The NEXORA helper predicates (`is_educator`, `teaches_class`…) return only booleans keyed to `auth.uid()`, so anon gets `false`. The real fix is least-privilege grants, excluding the 5 CWOA RPCs, which are intentionally public. | Confirmed (grants) / Suspected (exploitability) | Security advisor. |
| M3 | **Leaked-password protection is off.** | Confirmed | Advisor `auth_leaked_password_protection`. |
| M4 | **The `experience-files` storage bucket is public.** That's probably intentional (library content). I haven't checked that no student uploads land there. | Suspected | `storage.buckets`. |
| M5 | **Vercel Hobby is licensed for non-commercial use only.** The church booking and any district sale need Pro. | Confirmed (plan) | Team plan. |
| M6 | **AI pipeline in production isn't verified this session.** The model comes from `ANTHROPIC_MODEL` and defaults to `claude-sonnet-5-5`. There's no token or cost logging. Timeouts are passed per call. | Suspected | `src/lib/engine/ai.ts`. |

## Low

| # | Finding | Status |
|---|---|---|
| L1 | Version drift: `package.json` says `0.1.0`, the brand says `1.5.3`. | Confirmed |
| L2 | Unused server actions `signIn`/`signUp` remain after the move to browser auth. | Confirmed |
| L3 | `.env.local` holds only public values (Supabase URL + publishable key). No secret keys found in the source (grep for `sk-ant`, `service_role`). A full history scan comes when a repo exists. | Confirmed |
| L4 | No health-check endpoint or error monitoring. | Confirmed |

## What's already strong (measured, keep)
- RLS is enabled on every one of the 41 public tables.
- Core classroom RPCs were measured at ≤ ~41 ms p95 with 300 simulated students (join, Do Now, attendance, hands, hall passes). Cross-class RLS checks passed.
- Admin RPCs check `is_platform_admin()` internally.

---

## Safe implementation sequence

| Milestone | Scope | Risk to production | Needs from you |
|---|---|---|---|
| **M1 — Source control + safety net** | Private repo `nexora-learning-os`, secret scan, README/.env.example, migration catch-up (pull the missing 3 NEXORA migrations from the DB into the repo; CWOA migrations documented but kept out), `pg_dump` schema backup | None (read-only on the DB) | GitHub connected; you run one backup command |
| **M2 — Staging + CI** | Second free Supabase project `nexora-staging` built from the repo migrations; GitHub Actions (typecheck, lint, build, unit tests, audit, gitleaks); Vercel previews pointed at staging; production promotion only after green checks | None | Approve the staging project (free) |
| **M3 — Tests** | Vitest unit tests (engine, schedule, attendance, passes, retry queue), RLS/RPC integration tests on staging, Playwright e2e (teacher/student, EN/ES, mobile) | None | — |
| **M4 — Security hardening** | Least-privilege grants (NEXORA functions only), fix `material_status`, `jspdf` upgrade, leaked-password check — staged first, then production | Low, with rollback script | Approval before production |
| **M5 — AI evals + observability** | Token/latency/cost logging, eval set on synthetic materials, health endpoint | Low | — |
| **M6 — Load validation 30→300** | k6 against **staging** at 30/60/100/150; 300 requires Pro | None on staging | Approve Supabase Pro ($25/mo) for the 300 stage |
| **M7 — Docs + FDE package** | The 11 docs + interview package, every claim linked to evidence | None | — |
