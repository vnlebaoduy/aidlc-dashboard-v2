# AI-DLC Dashboard v2 — Design

Brand line: **an honest, at-a-glance read of an AI-DLC run.** It answers four
questions fast: is the run moving, what needs me, how far along is it, and what did
it cost.

Visual base: the "Bright Finance" system (`docs/design.md` in the AI-DLC project).
It is restrained and high-trust: a warm off-white page, white cards with 1px
borders, one yellow emphasis per view, blue for links and info, and Montserrat
everywhere.

## Delivery contract

- **Outcome:** a multi-page dashboard built with React, shadcn/ui and lucide. It
  covers everything v1 shows, organised so that each page answers one question.
  Light and dark themes, English and Vietnamese, usable down to 375px.
- **Constraints:**
  - The data layer is reused from v1 (`server/`) and keeps its tests.
  - The workspace is read-only.
  - The v1 security model stays: loopback bind, Host guard, cross-site guard on
    `/select`, `/open` and `/api/refresh`.
  - The client never renders workspace text as markup.
  - A release ships `web/dist` pre-built, so the customer needs only `bun`.
- **Non-goals:**
  - Korean.
  - Authentication. The server is still local-only, and `--host` exposes it
    unauthenticated, as in v1.
  - Changes to scan/model semantics.
  - The v1 diary and stream panels. They were never mounted in v1.
- **Acceptance:**
  - Every v1 panel's behaviour has a home in a v2 page.
  - `bun run typecheck`, `bun test` and `bun run build` all pass.
  - Screenshots at 1440, 768 and 375, in light and dark, show no overflow,
    clipping or overlap.
  - All icons are lucide. No emoji or unicode glyphs are used as icons.
  - `bun run dev` serves the app with HMR.

## Information architecture

```
Sidebar (collapsible; becomes a sheet on mobile)
├─ Overview        is it moving? what needs me? KPI trio + 4 summary cards (+ Outcomes pack card when OUTCOMES.md exists)
├─ Stages & Units  phase → stage list, artifacts, unit progress, stage × unit matrix
├─ Timeline        where the time went: buckets, gantt, rework, workers, gaps
├─ Decisions       deferred items & open questions (ledger, owners, routes)
├─ Usage           Kiro credit or Claude tokens, window 7d / 30d / all
└─ Sources         freshness of every input, warnings
Header: workspace switcher · run status pill · refresh · language · theme
Routes: /  /stages  /timeline  /decisions  /usage  /sources  /pick  /view?rel=
```

Every page carries a deep link. `?cw=` (the usage window) and `?lang=` survive
navigation between pages.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| background | #fafaf8 | #111110 | page |
| card / popover | #ffffff | #1a1a18 | surfaces |
| foreground | #000000 | #f5f5f4 | primary text |
| muted-foreground | #4b5563 | #a8a29e | supporting text (≥ 4.5:1) |
| primary | #ffc708 | #ffc708 | active pill, nav item, progress fill, the one emphasis |
| primary-foreground | #000000 | #000000 | text on yellow |
| action | #000 → hover #0070c9 | #f5f5f4 → #4aa3ef | strongest button |
| brand-blue / info | #0070c9 | #4aa3ef | links, info badges, chart-1 |
| success | #16a34a | #22c55e | done, healthy |
| warning(-foreground) | #f59e0b / text #a16207 | #f59e0b / #fbbf24 | waiting, stale |
| destructive | #dc2626 | #f87171 | failed, blocked |
| border | #e5e7eb | #2e2e2b | 1px structure |

- **Never yellow text on white.** Yellow is only ever a fill, with black text.
- **Type:** Montserrat Variable. Body is 14/22. Labels are 12/16 at weight 500.
  Card titles are 16/24 at 600. Page titles are 24/32 at 600. KPI figures are
  30–36 at 600 with tabular numbers.
- **Radius:**
  - Controls and inputs: 4px (`rounded-sm`).
  - Cards: 8px (`rounded-lg`).
  - Pills, badges and tab chips: full.
- **Spacing:** the rhythm is 4, 8, 12, 16, 24, 40 and 64. The page gutter is 24
  on desktop and 16 on mobile. The gap between sections is 24.
- **Elevation:** flat. Borders come first. Shadows are only used on
  popovers, sheets and the sticky header blur.

## Components

- **Buttons:** `default` is the yellow fill for the primary action of a view.
  `action` is black and turns blue on hover, for strong neutral actions. `outline`
  and `ghost` are for utilities. Height is 36 (`sm` is 32). Icons are 16px.
- **Tabs and segmented controls:** pill-shaped. The active one is a yellow fill
  with black text, as in design.md's tab-pill.
- **Cards:** white surface, 1px border, 8px radius, 16–24px padding, no shadow.
- **Status:** a lucide icon plus a word, never colour alone. The badge variants
  are success, warning, destructive, info and muted.
- **Data:** shadcn Table, with numeric columns right-aligned in tabular numbers.
  Wide tables scroll inside their card.
- **Charts:** hand-drawn SVG on chart-1 to chart-5. Every chart has a `<title>`
  per mark, role=img and an aria-label. Charts keep a minimum width and scroll on
  narrow screens.

## Motion

- Transitions run 150–200ms ease-out, on opacity and transform only.
- The live pulse dot only moves while the run is running.
- Everything is disabled under `prefers-reduced-motion`.

## Notifications

Notify only when the reader has a reason to act. Otherwise nobody keeps them on.

| Tier | Fires on | Delivery |
|---|---|---|
| Needs you | open gate · unanswered ask in the current stage · stop hook blocking · failed check in the current stage · run complete | warning toast (10s) + bell + `(N)` in the tab title + flashing tab title while the tab is in the background + OS notification when the tab is hidden and the reader allowed it |
| Milestone | `STAGE_COMPLETED` · `UNIT_COMPLETED` · `PHASE_COMPLETED` · `GATE_REJECTED` · `WORKFLOW_PARKED` | success toast (5s, can be switched off) + bell + flashing tab title (only when milestone pop-ups are on) |
| Silent | everything else (`STAGE_STARTED`, `HUMAN_TURN`, `SENSOR_*` …) | none |

- **Detection** (`web/src/lib/notify/detect.ts`, tested in
  `server/test/notify.test.ts`): every fact gets a stable key, and only a key
  this browser has not seen is news.
  - The first read of a workspace is the baseline. Opening the page never replays
    history.
  - Reloads and repeat polls never refire.
  - A gate that closes and later reopens does fire again.
- **Bursts:** a poll that brings several notices produces one toast per tier
  ("… +2"). Every item still lands in the bell, which holds the last 50 per
  workspace.
- **OS notifications:** the Notification API exists only in a secure context
  (https or localhost). Opened by IP over http it is missing, and the bell says
  so. With them on, a hidden tab keeps polling, so it can still notice.
- **Flashing title:** when the tab is in the background, the title alternates every second between `● <notice>` and the normal title. It stops the moment the tab is shown. It is on by default and can be switched off in the bell. While it is on, a hidden tab keeps polling.
- **Data:** everything stays in the browser's localStorage. Nothing is sent
  anywhere.

## Voice

Short and factual. A missing number is "—", never 0. A cap always says what it
cut, for example "+3 more". Workspace text (headings, file names, feedback) is
quoted verbatim and never translated.

## Do / Don't

- Do show one yellow emphasis per view.
- Do prefer borders over shadows.
- Do put an icon and a label on every status.
- Don't use emoji or unicode glyph icons.
- Don't put gradients or heavy shadows on cards.
- Don't put yellow text on light surfaces.
