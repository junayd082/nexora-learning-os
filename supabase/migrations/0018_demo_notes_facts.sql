-- NEXORA 1.5.1 — the demo class's seeded teacher notes only say what NEXORA can really produce
-- (per-question % correct, not which wrong answer students picked). 0017_attendance.sql already
-- carries the corrected line; this re-runs the reset for databases that ran 0017 before the fix.
select public.demo_live_reset();
