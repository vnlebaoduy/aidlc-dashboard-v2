// Deciding from the app: the exact words, and the send that may happen once.
//
// The app never edits `aidlc-state.md` or the audit. A decision is delivered as the
// person's own message into the intent's Kiro Crew session, and AI-DLC validates it
// there. Two invariants drive this module:
//
//   1. The text a person sees before pressing Send is byte-for-byte what is sent.
//      `composeAnswer` is the only producer of that text, and the form renders its
//      return value.
//   2. A decision is delivered at most once, and "resolved" is a separate state
//      from "delivered": an HTTP 200 proves delivery, never that the engine acted.
//      `beginSend` refuses a repeated `sendId`, and only `markResolved` (called
//      after the audit and state agree) closes the decision.
//
// The host transport (`POST /api/chat`) is not wired here: it needs the gateway.

export type DecisionChoice = "approve" | "request-changes" | "answer";

export interface DecisionDraft {
  /** Stage (or Unit) the decision belongs to, verbatim from the model. */
  stage: string;
  unit?: string;
  choice: DecisionChoice;
  /** Required for `request-changes`; the person's own words. */
  feedback?: string;
  /** Required for `answer`; the person's own words. */
  answer?: string;
}

export type SendStatus = "pending" | "delivered" | "uncertain" | "resolved" | "refused";

export interface SendRecord {
  /** Stable per decision; retries reuse it. */
  sendId: string;
  slotKey: string;
  text: string;
  status: SendStatus;
  /** Refusal code or the reason a delivery is uncertain. */
  detail?: string;
}

const MAX_TEXT = 8000;

/** The exact message a decision sends. Never reword elsewhere. */
export function composeAnswer(draft: DecisionDraft): string {
  if (draft.choice === "approve") return "Approved.";
  if (draft.choice === "request-changes") {
    const feedback = draft.feedback?.trim() ?? "";
    return feedback.length > 0 ? `Request changes: ${feedback}` : "";
  }
  return draft.answer?.trim() ?? "";
}

/** Why this decision cannot be sent, as codes rather than prose. */
export function validateDraft(draft: DecisionDraft): string[] {
  const problems: string[] = [];
  if (draft.stage.trim().length === 0) problems.push("missing-stage");
  const text = composeAnswer(draft);
  if (text.length === 0)
    problems.push(draft.choice === "request-changes" ? "missing-feedback" : "missing-answer");
  if (text.length > MAX_TEXT) problems.push("answer-too-long");
  return problems;
}

export interface BeginResult {
  /** False when this `sendId` was already used; callers must not send again. */
  send: boolean;
  record: SendRecord;
}

/** Start (or re-read) a send. A known `sendId` is never sent twice. */
export function beginSend(
  existing: SendRecord | undefined,
  next: Omit<SendRecord, "status">,
): BeginResult {
  if (existing && existing.sendId === next.sendId) {
    return { send: false, record: existing };
  }
  return { send: true, record: { ...next, status: "pending" } };
}

export function markDelivered(record: SendRecord): SendRecord {
  if (record.status !== "pending") return record;
  return { ...record, status: "delivered" };
}

/** A send whose outcome we cannot prove. It never becomes resolved by itself. */
export function markUncertain(record: SendRecord, reason: string): SendRecord {
  if (record.status === "resolved" || record.status === "refused") return record;
  return { ...record, status: "uncertain", detail: reason };
}

export function markRefused(record: SendRecord, code: string): SendRecord {
  if (record.status === "resolved") return record;
  return { ...record, status: "refused", detail: code };
}

/**
 * Close a decision only when the engine's own record shows it acted.
 * `evidence` is the caller's proof (audit row + state transition), never an HTTP code.
 */
export function markResolved(record: SendRecord, evidence: string): SendRecord {
  if (record.status !== "delivered") return record;
  return { ...record, status: "resolved", detail: evidence };
}
