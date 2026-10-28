---
title: "Phase 3: Engine signals, plugins, spaces and knowledge"
status: todo
---

# Phase 3: Engine signals, plugins, spaces and knowledge

## Goal

Cover the upstream planes the dashboard currently ignores: `.aidlc-engine/` decision signals, plugin-composed stages, phase verification files, the space/intent registry, and the knowledge/codekb inputs that Sources promises to describe.

## Evidence

- Unread today (0–2 hits in `server/`): `reviews/`, `guard-refusals/`, `human-turn`, `turn-end`, `reviewer-dispatch`, `source-review`, `summary-authorization`, `phase-check`, `documentkb`, `codekb`, `plugins`, `plan.json`.
- Upstream `docs/guide/14-artifacts-reference.md` lists these paths under `<record>/.aidlc-engine/` and `verification/`; `docs/guide/03-spaces-and-intents.md` defines `intents.json` and space-level `knowledge/`.
- Upstream 2.11.1 changelog: plugin stages compose into the catalogue and can vanish after a refresh.

## Files to Create / Modify

- Create: `server/scan/engine-signals.ts` (reviews, guard refusals, human-turn/turn-end, active directive)
- Create: `server/scan/plugins.ts`, `server/scan/spaces.ts`, `server/scan/knowledge.ts`
- Modify: `server/scan/phase checks` path — add `server/scan/verification.ts`
- Modify: `server/model/assemble.ts`, `server/model/types.ts`, `server/model/status.ts`
- Modify: `web/src/features/overview/health.tsx` (needs-you signals), `web/src/features/decisions/*`, `web/src/features/sources/*`
- Create: tests per module plus fixtures

## Tasks & Steps

1. **Engine signals.** Read `reviews/` for reviewer verdicts and findings, `guard-refusals/` counters, `human-turn`/`turn-end` for a stalled turn, `active-directive` for the current cursor. Map guard stop and stalled turn into the action tier.
2. **Plugins.** Detect installed plugins and their stage contributions; extend the stage catalogue with composed stages; when a plugin is present but unreadable, warn and mark coverage as core-only instead of reporting missing artifacts.
3. **Spaces and intents.** Enumerate `spaces/*` and `spaces/<space>/intents/*` plus `intents.json` (status, repos, scope); expose selection (server list API only in this phase) and show repo/worktree identity for multi-repo intents.
4. **Knowledge and codekb.** Read `memory/` chain files (names and freshness), `knowledge/documents` (counts) and `documentkb/index.json` (states, tombstones), `codekb/<repo>` freshness; add rows to Sources.
5. **Phase checks.** List `verification/phase-check-<phase>.md` with timestamp and outcome per phase.
6. **Plan file.** Read `.aidlc-engine/plan.json` stage counts, and `Plan` / `Stages added|skipped` from `WORKFLOW_STARTED`, to distinguish a composed plan from a scope default.
7. Every new read degrades with a named warning when the plane is absent.

## Verification

- `bun test` covers: reviews parsed, guard refusal raises an action notice, stalled turn raises an action notice, plugin stage composed, plugin unreadable warns, two spaces listed, documentkb tombstones counted, phase checks listed, plan.json vs scope shown.
- Fixtures: extend `fixtures/reference-2.11` with `.aidlc-engine/reviews`, `guard-refusals`, `verification/`, `knowledge/documentkb/index.json`, a plugin stage, and a second space.
- Sources lists every plane read, with absent planes named, never silently blank.

## Success Criteria

- "What needs me" includes guard stops and stalled turns, not just gates/questions/checks.
- Stage coverage never claims a plugin-composed stage is missing.
- Sources describes every input the engine documents, or says which one is missing.
- No write to any workspace path.

## Risk Assessment

- `.aidlc-engine` is gitignored: absent on fresh clones; the page must say "engine state not present" rather than "healthy".
- Reviewer record schema is internal; parse only what the UI shows and keep unknown fields opaque.
- Plugin composition could double-count stages; dedupe by slug with plugin provenance shown.

## Progress

- [x] `server/scan/engine-signals.ts`: guard-refusal streaks (`count`, `codes`, Unit, `pendingAsk`) and turn state from the `human-turn` / `engine-touch` markers; absent plane returns undefined, malformed records are skipped.
- [x] The model exposes `signals`; tests cover streak ordering, the left-over ask, malformed records and both turn states.
- [ ] Surface guard refusals and a stalled turn in the "needs you" queue (Phase 4 UI; needs a product decision on which tier).
- [ ] Reviews: format is per-stage `<stage dir>/reviews/review-NN.md` plus digest-bound records in `.aidlc-engine/`; read the writer before parsing verdicts.
- [ ] Plugins, spaces/intents registry, knowledge/documents + documentkb, codekb, phase checks, plan.json.

