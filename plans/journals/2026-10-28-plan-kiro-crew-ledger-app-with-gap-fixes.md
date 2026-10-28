---
title: Plan Kiro Crew Ledger app with gap fixes
date: 2026-10-28
summary: "Route the app build into a 6-phase plan: Node backend, upstream gap fixes, Studio-inspired frames without Usage, exactly-once answering, store release."
---

# Plan Kiro Crew Ledger app with gap fixes

## Decision

Route the implementation through `ak:plan`: the app is a native Kiro Crew app ("AI-DLC Ledger") that reuses the TypeScript scan/model layer behind `backend.type: node`, publishes from `apps/kirocrew/` with a registry `subdirectory`, and carries no Usage page. The standalone dashboard keeps Usage unchanged.

## Gap fixes folded into phases

- Runtime-graph `stages[]` becomes the execution-time source, audit stays as cross-check (G2).
- Full `aidlc-state.md` settings block parsed and shown (G4).
- Engine signals (`reviews`, `guard-refusals`, `human-turn`/`turn-end`, `active-directive`) feed "Needs you" (G3).
- Plugins, phase checks, spaces/intents registry, knowledge/documents + documentkb, codekb and plan.json covered with honest degradation (G5-G9).
- Usage/harness usage gap is out of scope for the app by decision.

## Frames

Borrow information architecture from AI-DLC Studio (decision queue, workflow map, evidence drawer, stage inspector, provenance strip). Keep DESIGN.md tokens and copy voice; no code or brand reuse.

## Verification

`ak plan validate` reports a valid plan directory: 6 phases, 0/6 done. Plan: plans/261028-0359-kirocrew-ledger-app.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
