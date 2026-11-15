# NEXORA — The Learning Operating System

**Learn. Build. Explore. Become.**

NEXORA is a classroom platform built by a high-school CTE teacher for his own classes. It covers classes and join codes, materials, assignments and grading, AI-generated Do Now and Exit Ticket checks, attendance, hall passes, Raise Hand, bell-schedule timers, Cornell Notes, portfolios, AI-assisted CVs, session summaries, presentation mode, and Nova, a rule-based companion. Everything is in English and Spanish.

- **Production:** https://nexoraclass.vercel.app
- **Release:** 1.5.3 ("Class day"). See [CHANGELOG.md](CHANGELOG.md)
- **Product owner:** M. Chinnakotla. Built with AI-assisted development: Claude wrote most of the source code. The product owner directed requirements, reviewed the work, ran acceptance testing, and manages infrastructure and deployments.

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 15.5 (App Router), React 19, TypeScript 5.9, Tailwind CSS 3 |
| i18n | next-intl (EN/ES), messages in `messages/` |
| Data / auth | Supabase Postgres with row-level security on every table, SECURITY DEFINER RPCs, Supabase Auth, Storage, Realtime |
| AI | Anthropic Claude API (server-only), `src/lib/engine/` |
| Hosting | Vercel |

## Repository layout

```
src/app/            routes ((site) = signed-in app, auth, demo, keynote)
src/components/     UI components
src/lib/            domain logic: engine/ (AI + built-in question engine), attendance, bell, live (realtime), supabase/
messages/           en.ts / es.ts translation catalogs
supabase/migrations SQL migrations (see note below)
scripts/            load-test scripts (loadtest-*.mjs) and video scripts
docs/               AUDIT.md (engineering audit), USER_GUIDE.md (teacher-facing guide)
```

## Local setup

Requirements: Node.js ≥ 18.18 (CI uses Node 22).

```bash
npm ci
cp .env.example .env.local   # optional: defaults in src/lib/supabase/env.ts point at the production project
npm run dev                  # http://localhost:3001
```

AI question generation needs `ANTHROPIC_API_KEY` set as a **server-only** variable. Without it, NEXORA falls back to the built-in (non-AI) engine.

Checks:

```bash
npm run typecheck
npm run build
```

## Database migrations

`supabase/migrations/` holds the NEXORA schema. The production database records 24 applied migrations:

- 3 of them (`0011_hand_position`, `0016_demo_live_class_seed`, `0017_attendance_demo_reset`) were applied as separate steps. Their content is folded into files `0010`, `0016` and `0017` here.
- 2 of them (`cwoa_*`) belong to a separate client project that shares the Supabase instance. They are **not** part of this repo.

Proving that these files rebuild the production schema exactly is a Milestone 2 task: apply them to a fresh staging project and compare function and policy definitions.

## Security

- Never commit `.env*` files except `.env.example`. The Supabase **publishable** key is browser-safe by design. Service-role and `sb_secret_` keys, and the Anthropic key, must never appear in the source.
- Secret scanning runs in CI with [gitleaks](https://github.com/gitleaks/gitleaks). See `.gitleaks.toml`.
- Known findings and their priority: [docs/AUDIT.md](docs/AUDIT.md).

## Deployment

Production is currently deployed manually (`npm run deploy` → `vercel --prod`). Moving to Git-based previews and a gated production promotion is planned for Milestone 2. Until then, deploy only from a commit on `main` that has passed CI.
