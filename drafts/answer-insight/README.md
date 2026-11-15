# DRAFT — Answer insight ("What students chose")

Status: **parked** (Oct 28, 2026). Not compiled, not shipped. `drafts/` is excluded in tsconfig.json.

## What it is
For every Do Now / Exit ticket question, show what students actually chose — not just % correct:
- each option (or each distinct typed answer) with count, %, and which students chose it
- the most common wrong answer, highlighted
- the likely misconception behind it, plus the lesson quote that proves the right answer
- "Re-teach with a Do Now" → opens the generator with the focus filled in

This is the moment in NEXORA Live chapter 7 ("48% typed @10'<0 — they think 0° points up")
that NEXORA cannot show yet. Until this ships, the film overstates the results page there.

## What is done
- `insight.ts` — pure analysis: `questionInsight(question, attempts, labels)` and `wrongLine()`.
  Handles multiple choice, true/false, fill in the blank, ordering, matching (grouped answers)
  and short answer (graded buckets). Reads misconceptions from `key.why` and the proof from `key.source.quote`.

## What is left (plan)
1. Move `insight.ts` back to `src/lib/engine/` (fix the import back to `./types`), remove `drafts` from tsconfig exclude if empty.
2. Results page (`src/components/checks/Manage.tsx` → `Results`): replace the % bars with a
   "What students chose" card per question; biggest-gap card on top; names on click; absent students excluded.
   Pass `source_material_id` from `checks/[id]/page.tsx` for the re-teach link
   (`/classes/{id}/checks/new?kind=do_now&source=…&focus=…`).
3. Generator (`src/lib/engine/ai.ts`): add `distractor_why: string[]` to the QUESTION schema (+ required list);
   in `types.ts` `fromRaw` store it as `key.why` `{ optionId: reason }` (TF: `{ "true"|"false": reason }`);
   `generate.ts` `spreadAnswers` must remap `key.why` when it reorders options.
   Prompt line: every wrong option reflects a real, common misconception; one short sentence each.
4. Question editor: optional "Why might a student pick this?" field under each wrong option.
5. Session summary (`src/lib/summary.ts` `resultsFor` + `engine/summary.ts`): add the top wrong answer
   and its why to `CheckResult.questions`, use it in `teacherMarkdown` hardest-questions lines and the AI `resultsBlock`.
6. Demo class: add `key.why` to the seeded Do Now / Exit ticket distractors in `demo_live_reset()`
   (e.g. Exit Q2 option b: "Thinks 0° points up; in AutoCAD 0° points right (east) and 90° is up.").
7. Messages EN/ES, release notes, version bump; verify on the demo class (Exit Q2: 43% / 48% / 9%).
