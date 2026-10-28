# AI-DLC Ledger (Kiro Crew app)

Read-only analysis of an AI-DLC v2 run, as a native Kiro Crew app.

- Backend: `backend/dist/server.js`, plain Node, bundled from `backend/src/server.ts`
  with the shared `server/scan` + `server/model` layer. The Gateway sets `PORT`,
  probes `/health`, and proxies `/api/apps/aidlc-ledger/*` to it.
- UI: `ui/dist/index.mjs`, a React ESM module the host mounts; React comes from
  the host import map, so the bundle keeps it external.
- No Usage panel: the app never imports `server/credit` and drops the usage slot
  from the model payload.

## Build

```bash
bun run app:build
```

`dist/` is committed on purpose: the store installs from git and starts
`backend/dist/server.js` with Node, without running a build step.

## Run locally

```bash
PORT=4350 AIDLC_LEDGER_ROOT=fixtures/reference node apps/kirocrew/backend/dist/server.js
curl -s localhost:4350/health
curl -s localhost:4350/api/apps/aidlc-ledger/model | head -c 200
```

## Permissions

`api` (this app's route only), `storage`. No `spawn`, no `network`, no `cron`,
no `mcpTools`. The workspace is read-only; a decision is delivered only through a
confirmed chat send in a later release.
