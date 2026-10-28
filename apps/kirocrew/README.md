# AI-DLC Management Tool (Kiro Crew app)

Analysis **and decisions** across every AI-DLC v2 project, as a native Kiro Crew app.

- Backend: `backend/dist/server.js`, plain Node, bundled from `backend/src/server.ts`
  with the shared `server/scan` + `server/model` layer. The Gateway sets `PORT`,
  probes `/health`, and proxies `/apps/aidlc-management-tool/api/*` to it.
- UI: `dist/index.mjs`, a page component the host renders (default export). React
  and lucide come from the host import map, so the bundle keeps them external.
- No Usage panel: the app never imports `server/credit` and drops the usage slot
  from the model payload.

## Install

```bash
kirocrew app install <repo>/apps/kirocrew
kirocrew config set agent.apps_trusted '["aidlc-management-tool"]'
kirocrew app enable aidlc-management-tool
```

Then open **Apps → AI-DLC Management Tool** and add one or more workspace paths.
They are stored in `<app>/data/projects.json` (the app's own data dir, outside every
workspace), validated when added and re-checked on every read.

## What it does

- **Projects** — the fleet table: every registered workspace with phase, progress,
  blockers and the folder that tells two same-named projects apart.
- **Queue** — everything waiting on a person across all projects: gates, open
  questions, guard stops, reviewer findings.
- **Answers** — a gate (approve / request changes) or a question can be answered
  from the app; the exact text is previewed and sent as your own message into the
  project's Kiro Crew session.

- **Overview** — phase, progress, blockers, gates, reviewer findings, and a warning
  when a guard is holding the run.
- **Stages & units** — every phase and stage with a status word, artifact counts and
  the engine's own span from `runtime-graph`.
- **Timeline** — where the time went, per stage.
- **Decisions** — the deferred ledger, and an answer form for an open gate with the
  exact text previewed before sending.
- **Sources** — freshness per input, knowledge/documents and catalog states,
  reviewer passes, plugins, the resolved plan, and the execution record.

## Interactive, but through AI-DLC

The app changes nothing by itself. A decision is sent as your message into the
intent's conversation, where AI-DLC validates it and records the transition; the
app reports "delivered", never "resolved".

## Answering a gate

The page (as the signed-in owner) lists chat slots, maps this workspace to the slot
whose `project` is the workspace or a folder inside it, and sends the previewed
text with a `sendId` to `POST /api/chat`. Delivery is at most once per `sendId`;
"resolved" is never claimed by the app — AI-DLC records the human turn and the
audit/state show the transition. A third-party app backend cannot list owner
sessions (the gateway refuses an app token there), which is why the send runs in
the page, not in the backend.

## Build and test

```bash
bun run app:build     # backend + UI bundles into dist/
bun run app:test      # backend decision/chat tests + UI render tests
```

`dist/` is committed on purpose: the store installs from git and starts
`backend/dist/server.js` with Node, without running a build step.

## Permissions

`api` (this app's route only) and `storage`. No `spawn`, no `network`, no `cron`,
no `mcpTools`. The workspace is read-only; the only write is an owner-confirmed
chat message.
