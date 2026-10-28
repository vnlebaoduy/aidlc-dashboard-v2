---
title: "Phase 1: App skeleton and Node backend"
status: todo
---

# Phase 1: App skeleton and Node backend

## Goal

Stand up `AI-DLC Ledger` as a Kiro Crew app inside this monorepo, with the shared TypeScript scan/model layer running behind `backend.type: "node"`, proven against `fixtures/reference`, and with no usage subsystem in the app build.

## Decisions carried in

- App lives at `apps/kirocrew/` in this repo; the registry entry uses `subdirectory` (KiroCrew publishing guide, section 10) so the scan layer is not duplicated.
- The app omits the Usage page and never imports `server/credit`. The standalone dashboard keeps Usage unchanged.
- Permissions: `api: ["/api/apps/aidlc-ledger/*"]`, `events` for workspace/change pokes, `storage: true`; `spawn: false`, `network: false`, `mcpTools: []`.

## Files to Create / Modify

- Create: `apps/kirocrew/app.json`
- Create: `apps/kirocrew/backend/server.ts` (Node entry: routes under `/api/apps/aidlc-ledger/*`)
- Create: `apps/kirocrew/backend/fs-store.ts` (workspace registry persisted through app storage)
- Create: `apps/kirocrew/ui/` (Vite + React + `@kirocrew/app-sdk`, one hello page)
- Create: `apps/kirocrew/README.md`
- Modify: `package.json` (workspace scripts), `.github/workflows/ci.yml` (build the app)

## Tasks & Steps

1. `kirocrew app init` style scaffold under `apps/kirocrew/` (manifest, opaque icon placeholder, UI build).
2. Add a storage adapter so `assemble()` and `readAuditLedger()` run under Node: replace `bun:sqlite` with `node:sqlite` behind the existing `CreditReadStore`-shaped interface, or compile the credit modules out of the app entry.
3. Reuse `server/scan` and `server/model` unchanged; add `apps/kirocrew/backend/routes.ts` mapping `GET /api/apps/aidlc-ledger/model`, `/sources`, `/view`.
4. Accept a workspace path from app storage or a configured root; validate it the same way `/select` does.
5. Prove one page renders live data from `fixtures/reference` inside the Kiro Crew shell.
6. Wire CI: `bun run verify` (existing) plus app build and manifest validation.

## Verification

- `bun run verify` passes at repo root.
- App build emits `apps/kirocrew/ui/dist/index.mjs`; app manifest parses and matches the App Kit schema.
- With KiroCrew installed: app installs, sidebar shows `AI-DLC Ledger`, the hello page shows the fixture run's phase/progress, and the backend log shows no Bun-only import.
- `grep -r "server/credit" apps/kirocrew` returns nothing.

## Success Criteria

- App runs natively in Kiro Crew with shared scan/model code and zero usage code.
- Node backend reads the fixture record without changing scan/model semantics (existing 379 tests still pass).
- No port is opened by the app; requests arrive through the Gateway.

## Progress (offline half)

- [x] `apps/kirocrew/app.json` with minimal permissions (`api`, `storage`; no spawn/network/cron).
- [x] `apps/kirocrew/backend/src/server.ts` bundled to `backend/dist/server.js`; runs under Node 22 with `PORT`, answers `/health`, `/api/apps/aidlc-ledger/meta`, `/api/apps/aidlc-ledger/model`.
- [x] Shared `assemble()` used unchanged; `usage` dropped from the payload; no `bun:sqlite` in the bundle (verified by grep and CI gate).
- [x] `apps/kirocrew/ui/src/index.js` bundled to `ui/dist/index.mjs` with `react`/`react-dom/client` external; `mount()` renders phase, progress, blockers, warnings.
- [x] `bun run verify` includes the app typecheck, lint and build; CI adds a plain-Node smoke run.
- [ ] Install in Kiro Crew, sidebar page renders fixture data, no own port (needs KiroCrew on `:5476`).


## Risk Assessment

- `bun:sqlite` has no direct Node twin: if `node:sqlite` cannot satisfy the credit interfaces, strip credit at the bundler boundary for the app and keep it standalone-only.
- KiroCrew's `backend.type: "node"` runtime version is unverified; confirm Node 22+ before committing to the adapter path.

## Security Considerations

- Least privilege: no `spawn`, no `network`; workspace reads jailed to the selected root.
- App storage holds workspace paths only; no tokens.
