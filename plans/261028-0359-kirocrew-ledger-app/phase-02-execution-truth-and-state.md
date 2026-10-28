---
title: "Phase 2: Execution truth and state settings"
status: completed
---

# Phase 2: Execution truth and state settings

## Goal

Make the dashboard read the two sources upstream declares authoritative — `runtime-graph.json` for execution and the full `aidlc-state.md` settings block — and stop re-deriving execution from the audit alone.

## Evidence

- Upstream `docs/reference/13-runtime-graph.md`: runtime-graph is the data-plane mirror of the stage graph, materialised per gate, carrying `workflow_id`, `started_at`, `stages[]` and `bolt_dag`.
- `server/scan/matrix.ts:419-461` reads only `bolt_dag`; `server/scan/timing.ts` derives spans from the audit.
- `server/scan/parser.ts:519` reads only `Scope`; upstream `state-template.md` defines Depth, Test Strategy, Guard Policy, Guards On/Off, Sensors, Learnings, Summary Confirmation, Plan Approval, Collaborators, Review Override, Plan, Construction Execution, Unit Gate Rhythm, Verification Command, Workspace State.

## Files to Create / Modify

- Create: `server/scan/runtime-graph.ts`
- Modify: `server/scan/timing.ts`, `server/scan/rework.ts` (prefer runtime-graph, audit as cross-check)
- Modify: `server/scan/parser.ts` (`AidlcState` settings fields)
- Modify: `server/model/types.ts`, `server/model/assemble.ts`
- Modify: `web/src/features/stages/hero.tsx`, `web/src/features/sources/identity-card.tsx`
- Create: `fixtures/reference-2.11/` (state with the settings block, runtime-graph with `stages[]`)
- Create: `server/test/runtime-graph.test.ts`, extend `server/test/scan.test.ts`

## Tasks & Steps

1. Parse `workflow_id`, `started_at`, `stages[]` (started/approved/memory), keep `bolt_dag`.
2. Compute stage spans from runtime-graph when present; keep audit-derived values and emit a `timing-divergence` warning when they differ beyond a threshold.
3. Extend `AidlcState` with the settings fields; render them on Stages (headline) and Sources (identity).
4. Add `Workspace State` (languages/frameworks/build) to Overview or Sources.
5. Build a 2.11 fixture by hand from the documented schema (no engine run required); keep the 2.7 fixture for legacy coverage.
6. Update EN/VI catalogues together.

## Verification

- `bun test server/test/runtime-graph.test.ts server/test/scan.test.ts` passes.
- On the 2.11 fixture, Timeline spans equal runtime-graph values and the divergence warning is absent; corrupting one audit row raises it.
- Stages shows Depth/Test Strategy/Guard Policy/Sensors/Collaborators; Sources shows the same under identity.
- Both fixtures render without new warnings.

## Success Criteria

- One execution source of truth, with divergence surfaced instead of silently averaged.
- Settings that change engine behaviour are visible before a reader asks why a gate behaved oddly.
- Legacy records (pre-settings) still render, with fields absent rather than zero.

## Risk Assessment

- Runtime-graph is gitignored and machine-local: absent on a fresh clone. Degrade to audit with an explicit warning, never invent spans.
- 2.12 may add fields; parse defensively and ignore unknown keys.

## Progress

- [x] `server/scan/runtime-graph.ts` reads `workflow_id`, `started_at` and per-stage spans; malformed or absent files return undefined.
- [x] `AidlcState` carries the Scope Configuration and Workspace State settings plus plan, worktree, bolt refs, construction execution, gate rhythm and verification command; absent stays undefined.
- [x] The model exposes `runtime` and raises `runtime-state-divergence` when the graph marks a stage completed that state.md does not.
- [x] Stages shows depth, test strategy, guard policy, sensors, plan approval and collaborators when the record carries them; Sources adds an Execution record row.
- [x] Tests: runtime-graph parser, settings parsing, and an end-to-end divergence case over a copied fixture.
- [x] Decision: keep the audit as the timing source (it survives a fresh clone) and show runtime-graph spans beside it; a completed-but-not-done divergence raises a warning.

