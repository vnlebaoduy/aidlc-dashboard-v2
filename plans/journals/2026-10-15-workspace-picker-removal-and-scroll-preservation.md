---
title: Workspace picker removal and scroll preservation
date: 2026-10-15
summary: Browser-local removal with restore; folder navigation keeps scroll position.
---

# Workspace picker removal and scroll preservation

## Changes

- Added Remove actions to workspace cards and rows. Browser-local exclusions persist across reloads and scans; Restore removed reverses them. Project files and active workspace stay unchanged.
- Folder links, root chips, breadcrumbs and hidden-folder toggles now use TanStack Router resetScroll=false. Root cause: the router defaults to resetting scroll on search navigation.
- Updated typed English/Vietnamese copy and README.

## Verification

- Before: selecting a folder changed scrollY from 227 to 0. After: child folders, roots, breadcrumbs and hidden toggle kept 100 to 100; Back/Forward preserved position.
- Exercised card/list removal, reload persistence, rescan exclusion, restoration and continued artifact reads in the browser. Built production smoke also passed.
- Reviewed light/dark screenshots at 1440, 768 and 375 px; fixed narrow-screen overflow in restore action.
- bun run verify passed: typecheck, Biome, 379 tests (0 failures), production build. Existing large-chunk warning remains.

## Scope

No project files are deleted. Removal is per browser and limited to the Workspaces found section. No commit or publication.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
