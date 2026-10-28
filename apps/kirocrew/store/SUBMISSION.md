# Store submission

## Entry

`registry-entry.json` in this directory is the authored catalog row for
[`kirodotdev/KiroCrewApps`](https://github.com/kirodotdev/KiroCrewApps):
`source.subdir` points at `apps/kirocrew` inside this repository, so the app and its
manifest stay next to the code it reuses.

## Verified locally

- `kirocrew app install apps/kirocrew` → `✅ installed aidlc-management-tool v0.1.0`, enabled,
  backend healthy over loopback, `minKiroCrewVersion` 0.3.0 satisfied by 0.10.0.
- In the running gateway (0.10.0): page renders in the host shell, five tabs switch,
  light and dark both readable with host theme variables, `/apps/aidlc-management-tool/api/*`
  answers 200, and evidence opens inline.
- Backend route tests: decision text/lifecycle (11), gateway adapter (6). UI render
  tests: 8. Repository gate: `bun run verify`.
- Registry row inserted into a local clone of `KiroCrewApps`:
  `python3 tools/validate.py` → `OK: catalog is valid`.

## Federated install (verified)

This repository doubles as a registry index (`app-registry.json` at the root):

```json
[{ "name": "aidlc-management-tool", "gitUrl": "https://github.com/vnlebaoduy/aidlc-dashboard-v2",
   "repo": "https://github.com/vnlebaoduy/aidlc-dashboard-v2", "branch": "main",
   "subdirectory": "apps/kirocrew" }]
```

`PUT /api/apps/registries` + `POST /api/apps/registries/refresh` then
`POST /api/apps/registry/install {"name":"aidlc-management-tool"}` installed it from the
published commit; the same-repo carve-out means the store reads art with the
owner's credentials.

## Submit

1. Fork `kirodotdev/KiroCrewApps`, append `registry-entry.json` to
   `catalog/official-registry.json`, run `python3 tools/validate.py`.
2. Open the PR with the evidence above and the app's `README.md`.
3. Bump `version` in `app.json` for every release; the registry pins a commit, so a
   submission references the exact commit that passed review.

## Limits stated on the listing

- Read-only except an owner-confirmed answer to an open gate.
- No usage/credit panel.
- AI-DLC v2 records only.
- A decision needs a Kiro Crew session bound to the same workspace; without one the
  form says so and sends nothing.
