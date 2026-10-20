---
title: Render Mermaid in Markdown previews
date: 2026-10-06
summary: Repair diagram previews without changing workspace Markdown or Raw mode
---

# Render Mermaid in Markdown previews

## Root cause
The Markdown renderer treated Mermaid fences as ordinary code.

## Changes
Added a local Mermaid renderer with strict configuration, serialized rendering, inert SVG images, theme updates, source fallback on errors, and keyboard scrolling. Blocked HTML label images and image-shaped nodes before resource loading. Updated English/Vietnamese copy and README.

## Evidence
Browser: three diagrams in the reported user-flow file; Preview/Raw transitions; malformed source isolation; ordinary code preserved; hostile labels and image nodes make no external requests; light/dark at 1440, 768, 375 px; system-theme changes; keyboard scroll.

## Trade-off
Mermaid adds bundled diagram engines; Vite warns about the large optional ELK chunk. No workspace files were changed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
