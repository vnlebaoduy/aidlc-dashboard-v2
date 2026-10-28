---
title: "AI-DLC Ledger for Kiro Crew"
description: "Native Kiro Crew app: read-only AI-DLC v2 analysis with upstream-plane coverage, Studio-inspired frames, and exactly-once gate answering."
status: pending
priority: P1
effort: 6w
branch: main
tags: [feature, frontend, backend, infra]
blockedBy: []
blocks: []
created: 2026-10-28
---

# AI-DLC Ledger for Kiro Crew

## Overview

Ship `AI-DLC Ledger` as a native Kiro Crew app that reads an AI-DLC v2 run honestly — state settings, runtime-graph execution truth, engine signals, spaces, knowledge and plugin-composed stages — and lets a reader answer a gate or question exactly once. The app keeps this repository's design language, borrows Studio's information frames rather than its code, and carries no Usage page.

## Decisions

- **Usage leaves the app.** The standalone dashboard keeps its Usage page; the app never imports `server/credit` and shows no credit or token panel.
- **Frames from Studio, identity from here.** Decision queue, workflow map, evidence drawer, stage inspector and provenance strip are learned as information architecture; `DESIGN.md` tokens, copy voice and components stay ours.
- **One repo, one shared scan layer.** The app lives at `apps/kirocrew/` and is published with the registry `subdirectory` field.
- **Gaps fixed during app development**, in the order below, because they decide what the app can honestly show.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [App skeleton and Node backend](./phase-01-start.md) | Pending |
| 2 | [Execution truth and state settings](./phase-02-execution-truth-and-state.md) | Pending |
| 3 | [Engine signals, plugins, spaces and knowledge](./phase-03-engine-signals-and-knowledge.md) | Pending |
| 4 | [Native UI frames in the Ledger style](./phase-04-native-ui-frames.md) | Pending |
| 5 | [Decision answering, exactly once](./phase-05-decision-answering.md) | Pending |
| 6 | [Store release](./phase-06-store-release.md) | Pending |
| 7 | [Studio parity, interactive](./phase-07-studio-parity.md) | Pending |

## Contract

**Outcome:** an installable Kiro Crew app that answers "is it moving, what needs me, how far along, what is undecided, where is the evidence" for an AI-DLC v2 run, and delivers a decision into the intent's own session once.

**Constraints:** read-only workspace; Gateway auth, no own port, `network: false`, `spawn: false`; least-privilege permissions; `DESIGN.md` rules; EN + VI; `bun run verify` stays green; no iframe; no fork of Studio.

**Non-goals:** Usage/credit/token panels in the app; approve/park/resume/start; cross-repo Action Center; plan composer; installer; AI-DLC v1; unattended approval; engine release-version probing outside the workspace.

**Acceptance:**
- App installs from a registry entry and renders six routes natively, in light and dark, at 1440/768/390.
- Read-only routes leave `aidlc/` byte-identical; the only write path is a confirmed chat send.
- A gate answer is delivered once, and resolved only when audit and state show it.
- Absent planes (runtime-graph, engine state, knowledge) are named as warnings, never rendered as healthy.
- Plugin-composed stages are not reported as missing artifacts.
- Standalone dashboard still passes typecheck, lint, 379 tests and build.

## Dependencies

- KiroCrew installed locally (gateway on `:5476`) before Phase 1 verification.
- A 2.11-era record for fixtures; built by hand from the documented schema.
- App Store review by the `KiroCrewApps` curators for Phase 6.
