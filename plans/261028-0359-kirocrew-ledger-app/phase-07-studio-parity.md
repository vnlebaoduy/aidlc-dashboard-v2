---
title: "Phase 7: Studio parity, interactive"
status: todo
---

# Phase 7: Studio parity, interactive

## Goal

Match AI-DLC Studio's capability set inside the Management Tool: every human decision is answerable, every project and intent is reachable, and the workflow is drawn the way the method runs — while every write still goes through AI-DLC's own conversation, never around it.

## Shipped first (this phase's start)

- Live project list (validated, persisted, migrated from the single workspace), fleet table and cross-project queue.
- Stage inspector: artifacts, reviewer passes, sensor failures per stage.
- Interactive gate answers and question answers, previewed and sent as the owner with a `sendId`.

## Remaining, in order

1. **Action Center parity** — plan approval, summary confirmation, "request changes" with feedback, per-Unit checkpoints; one queue across projects; delivery status verified against the audit (never HTTP alone).
2. **Workflow Map parity** — phase swimlanes, dependency overlay from `stage-graph` consumes/produces, per-Unit Construction lanes from `bolt_dag`, stage inspector drawer.
3. **Repository setup and installer** — register a repo, preflight read-only, install/upgrade AI-DLC harness with a receipt and previewed diff, uninstall keeping user files. Every mutation runs through the engine's own commands; the app never writes workflow files itself.
4. **Plan composer** — scope, depth, review intensity, test strategy → exact stage/gate/artifact counts, create intent paused.
5. **Workspace controls** — switch intent/space, preview scope/depth changes, rename/archive registrations.
6. **Activity/evidence** — one timeline with provenance for AI-DLC, Kiro Crew, Git and the app; drawer onto raw audit rows.

## Constraints

- Decisions: text previewed, sent once, resolved only from audit+state.
- Engine-owned files are never edited by the app; setup/upgrade use the engine CLI.
- Same permissions as today plus whatever each capability strictly needs; no spawn/network unless the installer requires it (declare it then).
- Workspace reads stay jailed; project paths validated on add and on every read.

## Risks

- Installer/composer touch the engine and can fail halfway; they need previews, receipts and rollback before shipping.
- Sending into owner sessions is owner-only by design; an app token is refused, so all decisions run in the page, and the backend cannot automate them.
- Studio is months of product work; this phase is delivered incrementally, capability by capability, each with host verification.
