---
title: "Phase 6: Store release"
status: todo
---

# Phase 6: Store release

## Goal

Publish `AI-DLC Ledger` to the Kiro Crew App Store with its own identity, assets, review evidence and a registry entry, without changing the standalone dashboard's release.

## Files to Create / Modify

- Create: `apps/kirocrew/assets/icon-512.png` (opaque), `icon-dark.png`, `screenshots/*.png`
- Modify: `apps/kirocrew/app.json` (displayName, description, tags, highlights, hero, minKiroCrewVersion)
- Create: `apps/kirocrew/README.md` (install, permissions, honest limits)
- Modify: `README.md` (link to the app), `CONTRIBUTING.md` (app section)
- Create: registry entry in `KiroCrewApps` fork (`catalog/official-registry.json`), `subdirectory: "apps/kirocrew"`

## Tasks & Steps

1. Finalise name, icon (aperture/ledger mark, opaque 512×512) and screenshots at ~1200px, light and dark.
2. Write the listing copy: one paragraph, five highlights, permissions explained, limits stated (no write beyond chat, no usage panel, AI-DLC v2 only).
3. Test install through a federated external registry before submitting to the official catalog.
4. Open the registry PR with the pinned commit and version; run the repo's offline gate (`tools/validate.py`).
5. Tag the release; update the app version and `minKiroCrewVersion`.
6. Add CI for the app: manifest check, UI build, backend tests, screenshots diff (optional).

## Verification

- Fresh machine with KiroCrew installs the app from the registry entry; all 6 routes work.
- `tools/validate.py` passes in the `KiroCrewApps` checkout.
- Store card renders icon, hero and three screenshots; no 404.
- `bun run verify` still passes for the standalone dashboard.

## Success Criteria

- App installable from the official store with no manual steps beyond KiroCrew itself.
- Review feedback is limited to copy or assets, not architecture.
- Standalone and app releases are independent: a failing app build never blocks the dashboard release.

## Progress

- [x] `apps/kirocrew/assets/icon-512.png`: 512×512, RGB with no alpha channel (opaque), yellow aperture-and-ledger mark on ink; `icon.svg` kept as the source.
- [x] `app.json` declares `iconPath`.
- [ ] Screenshots, listing copy, registry entry, review.

## Risk Assessment

- Review may reject a second AI-DLC app for overlap; the listing must state the difference (read-only analysis, evidence, no control plane).
- "AI-DLC" naming may be questioned; keep it descriptive and note it observes the upstream method.
- Registry pinning means every release needs a new commit reference and version bump.
