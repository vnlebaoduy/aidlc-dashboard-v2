---
title: "Phase 5: Decision answering, exactly once"
status: todo
---

# Phase 5: Decision answering, exactly once

## Goal

Let a reader answer a gate or a question from the app, with the exact text shown before sending, delivered once into the intent's own Kiro Crew session, and marked resolved only when AI-DLC's audit and state show it.

## Evidence

- Kiro Crew apps can `POST /api/chat` with `slotKey` and `meta.sendId` when `/api/chat` is granted (App SDK chat docs); approvals need a separate permission we do not require here.
- Upstream records a human turn from the session; the engine validates and commits the transition (`docs/guide/10-state-and-audit.md`).
- Studio's model: preview the exact text, at-most-once, never resolve on HTTP 200 alone.

## Files to Create / Modify

- Create: `apps/kirocrew/backend/decisions.ts` (session mapping, send, verify)
- Create: `apps/kirocrew/ui/src/frames/answer-form.tsx`
- Modify: `apps/kirocrew/app.json` (`permissions.api` adds `/api/chat`)
- Create: `apps/kirocrew/backend/decisions.test.ts`

## Tasks & Steps

1. Map an intent record to its Kiro Crew session: use the audit `HUMAN_TURN`/message ids and `intents.json`, store the mapping per workspace in app storage; never guess when ambiguous.
2. Build the answer form for gates (approve, request changes, feedback) and questions (`[Answer]:` block).
3. Show the exact outgoing text, the session title and the target record before Send.
4. Send with a stable `sendId`; disable the control while in flight; retry only with the same id.
5. After send, poll audit + state until the engine records the human turn and the gate closes; only then mark resolved. Timeout → "delivery uncertain" state, never "done".
6. Refuse when the mapping is missing, the session is not the intent's, or the record changed since the form opened.
7. Log nothing to the workspace; no local file writes.

## Verification

- 20 repeated submissions of the same answer produce one delivered message and one audit row.
- A gate answer that the engine rejects keeps the form open with the engine's own words, not a generic error.
- Killing the app between send and poll leaves state "delivery uncertain" on restart, with a link to the session.
- 403 from a missing permission renders a permission explanation, not a crash.

## Success Criteria

- A decision is either provably delivered or explicitly uncertain; never silently lost and never double-sent.
- The app never edits `aidlc-state.md`, audit files or workflow files.
- Ambiguous intent/session mapping blocks sending with a named reason.

## Risk Assessment

- `/api/chat` may not accept third-party app tokens for an existing session; test this in Phase 1 and stop the phase if it fails, falling back to deep-linking the Studio gate.
- Session ownership rules may require the user to have the session open; surface that instead of retrying.
- Sending consumes a human turn; the UI must make that consequence explicit.
