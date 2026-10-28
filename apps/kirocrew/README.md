# AI-DLC Ledger (Kiro Crew app)

Read-only analysis of an AI-DLC v2 run, as a native Kiro Crew app.

- Backend: `backend/dist/server.js`, plain Node, bundled from `backend/src/server.ts`
  with the shared `server/scan` + `server/model` layer. The Gateway sets `PORT`,
  probes `/health`, and proxies `/apps/aidlc-ledger/api/*` to it.
- UI: `dist/index.mjs`, a page component the host renders (default export). React
  and lucide come from the host import map, so the bundle keeps them external.
- No Usage panel: the app never imports `server/credit` and drops the usage slot
  from the model payload.

## Install

```bash
kirocrew app install <repo>/apps/kirocrew
kirocrew config set agent.apps_trusted '["aidlc-ledger"]'
kirocrew app enable aidlc-ledger
```

Then open **Apps → AI-DLC Ledger** and name a workspace once. The path is stored in
`<app>/data/workspace.json` (the app's own data dir, outside every workspace) and
can be changed later by clearing it.

## What it does

- **Overview** — phase, progress, blockers, gates, reviewer findings, and a warning
  when a guard is holding the run.
- **Stages & units** — every phase and stage with a status word, artifact counts and
  the engine's own span from `runtime-graph`.
- **Timeline** — where the time went, per stage.
- **Decisions** — the deferred ledger, and an answer form for an open gate with the
  exact text previewed before sending.
- **Sources** — freshness per input, knowledge/documents and catalog states,
  reviewer passes, plugins, the resolved plan, and the execution record.

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
