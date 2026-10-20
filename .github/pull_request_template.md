## What and why

<!-- The problem, the change, and the question it answers. Link the issue: Fixes #123 -->

## Scope

<!-- What this changes, and what it deliberately leaves alone. -->

## Verification

<!-- Commands you ran and what you observed. Do not paste claims you did not check. -->

- [ ] `bun run verify` passes
- [ ] The changed path was exercised in a browser against `fixtures/reference`
- [ ] Screenshots checked in light and dark at 1440, 768 and 375 px (UI changes only)

## Project constraints

- [ ] The workspace stays read-only (no new writes outside `data/`)
- [ ] `Host` guard, cross-site guard and the artifact jail are unchanged or strengthened
- [ ] Copy added to both `en.ts` and `vi.ts`, typed through `catalog.ts`
- [ ] `DESIGN.md` rules followed (lucide icons, icon plus word for status, no workspace markup)
- [ ] Docs updated when behaviour, appearance or setup changed
- [ ] No secrets, credentials, machine-specific paths or private workspace data
