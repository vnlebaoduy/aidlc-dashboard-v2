---
title: Show question answers and OUTCOMES.md
date: 2026-10-07
summary: Answer lines swallowed as link definitions; outcomes pack card with root fallback
---

# Show question answers and OUTCOMES.md

## Root causes
- `[Answer]: A` is a CommonMark link reference definition (label Answer, URL A), so react-markdown rendered nothing; multi-word answers survived. A later multi-word `[Answer]` even became a link to the first definition.
- OUTCOMES.md is written at the workspace root; the dashboard never read it and the viewer jail is the record.

## Changes
- web/src/features/viewer/answers.ts: remark pass restores unreferenced definitions and `[Answer]` references verbatim, boxes answers, marks chosen options (letters that all exist in the nearest option block, or exact list-item text); free text highlights nothing.
- server/scan/outcomes.ts: record copy first, workspace root fallback for the exact name OUTCOMES.md only, both through resolveArtifact; model.outcomes; /api/view and /open use artifactBase.
- Overview Outcomes pack card, flags a root copy.

## Evidence
answers.test.ts (7) and outcomes.test.ts (5) incl. jail and symlink cases; browser on intent-capture and contract-design questions and Overview -> OUTCOMES.md; bun run verify 365 pass.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
