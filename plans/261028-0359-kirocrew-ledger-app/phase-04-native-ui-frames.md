---
title: "Phase 4: Native UI frames in the Ledger style"
status: completed
---

# Phase 4: Native UI frames in the Ledger style

## Goal

Build the app's pages natively with `@kirocrew/app-sdk`, borrowing Studio's information frames (decision queue, workflow map, evidence drawer) while keeping this project's design tokens and dropping Usage.

## Decisions carried in

- Learn **frames**, not code: Studio is Apache-2.0 and has its own brand; we reuse the information architecture only.
- Keep `DESIGN.md`: yellow `#ffc708` as the single emphasis, Montserrat, 1px borders, icon + word for status, lucide only, no emoji, 8px cards, 4px controls.
- No Usage page in the app. Standalone keeps it.

## Frames to build

| Frame | Source of the idea | Read-only behaviour |
|---|---|---|
| Decision queue | Studio Action Center | Ordered list of gates, questions, guard stops, failed checks; evidence beside each row |
| Workflow map | Studio Workflow Map | Phase swimlanes, stage inspector, unit lanes from `bolt_dag`, dependency edges |
| Evidence drawer | Studio evidence trail | Opens the exact artifact/audit row in the viewer with a line anchor |
| Stage inspector | Studio stage inspector | Artifacts, acceptance, sensors, reviewer verdicts, revisions |
| Provenance strip | Studio activity attribution | Every figure says which plane it came from (state/runtime-graph/audit/knowledge) |

## Files to Create / Modify

- Create: `apps/kirocrew/ui/src/pages/{overview,stages,timeline,decisions,sources,view}.tsx`
- Create: `apps/kirocrew/ui/src/frames/{decision-queue,workflow-map,evidence-drawer,inspector}.tsx`
- Create: `apps/kirocrew/ui/src/lib/{api,search,export}.ts`
- Modify: `apps/kirocrew/app.json` (pages, icons, sidebar order)
- Reuse copy patterns from `web/src/i18n/*` but keep the app's catalogue separate

## Tasks & Steps

1. Map each existing page to a host page route; mount order Overview → Stages → Timeline → Decisions → Sources → View.
2. Compose the decision queue from `blockers`, `gates`, engine signals; keep it read-only in this phase.
3. Build the workflow map with swimlanes and a stage inspector drawer; keep charts as hand-drawn SVG with `<title>` per mark.
4. Add the evidence drawer: row → `view?rel=` with `#Lx` anchor; viewer highlights the range.
5. Add record-wide search and export (Markdown/JSON) plus a command palette with `g k` style shortcuts.
6. Keep the host's theme/nav; the app ships no sidebar, no header, no router.
7. Verify light/dark at 1440, 768, 390 and keyboard-only paths.

## Verification

- Every route renders in the Kiro Crew shell with host theme switching and no layout overflow at 390px.
- `grep -r "usage" apps/kirocrew/ui/src/pages` returns nothing user-facing.
- Screenshots: 6 pages × light/dark × 3 widths stored with the phase evidence.
- A11y: charts aria-labelled, focus visible, skip link works, palette keyboard reachable.

## Success Criteria

- Ledger reads as one product with the standalone dashboard, not a reskin of Studio.
- A reader can go from "what needs me" to the exact audit/artifact line in two clicks.
- No page borrows Studio copy, names or visual identity.

## Progress

- [x] `apps/kirocrew/ui/src/index.js` renders five tabs natively (Overview, Stages & units, Timeline, Decisions, Sources) with this project's tokens, icon-plus-word statuses and a single yellow emphasis.
- [x] Overview shows the needs-you list, gate count, findings and the guard-refusal warning; Stages matches artifacts and runtime durations; Timeline lists spans; Decisions reports ledger counts and items; Sources shows provenance, knowledge, reviews, plugins and the execution record.
- [x] Data comes only from `/api/apps/aidlc-ledger/model`; the bundle keeps `react`, `react-dom/client` and `lucide-react` external to the host import map.
- [x] Verified by server-rendering against `fixtures/reference` (6 tests) and by a browser harness that clicked every tab (1440 and 375, no horizontal overflow). The host shell itself is still unverified.
- [x] The app backend answers `/api/apps/aidlc-ledger/view?rel=` through the shared artifact jail, and Sources opens a review's text inline.
- [x] Verified end to end without the host: real Node backend + built bundle + harness proxy; clicking a review returned the file text (HTTP 200 both routes).
- [x] Host chrome checked on Kiro Crew 0.10.0 (five tabs, host theme variables in light and dark, no console errors) and six store screenshots captured from the running app surface.

## Risk Assessment

- Host React version and import map constrain libraries; Mermaid and TanStack Router may not be available — verify before committing to them, and fall back to plain SVG and host routing.
- Re-implementing all frames risks copying Studio's density; keep only the five frames above.
