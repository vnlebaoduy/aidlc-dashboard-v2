import { describe, expect, test } from "bun:test";
import {
  beginSend,
  composeAnswer,
  markDelivered,
  markRefused,
  markResolved,
  markUncertain,
  validateDraft,
} from "../src/decisions";

describe("composeAnswer", () => {
  test("approval sends one word, not the form's labels", () => {
    expect(composeAnswer({ stage: "functional-design", choice: "approve" })).toBe("Approved.");
  });

  test("request changes carries the person's words verbatim", () => {
    expect(
      composeAnswer({
        stage: "functional-design",
        choice: "request-changes",
        feedback: "  Rename the handler and add the 409 path.  ",
      }),
    ).toBe("Request changes: Rename the handler and add the 409 path.");
  });

  test("an answer is sent as typed, without decoration", () => {
    expect(composeAnswer({ stage: "scope-definition", choice: "answer", answer: "B" })).toBe("B");
  });
});

describe("validateDraft", () => {
  test("refuses empty feedback and empty answers", () => {
    expect(validateDraft({ stage: "s", choice: "request-changes", feedback: "   " })).toEqual([
      "missing-feedback",
    ]);
    expect(validateDraft({ stage: "s", choice: "answer", answer: "" })).toEqual(["missing-answer"]);
  });

  test("refuses a decision with no stage", () => {
    expect(validateDraft({ stage: " ", choice: "approve" })).toEqual(["missing-stage"]);
  });

  test("a plain approval is valid", () => {
    expect(validateDraft({ stage: "build-and-test", choice: "approve" })).toEqual([]);
  });
});

describe("send lifecycle", () => {
  const base = { sendId: "s-1", slotKey: "intent-42", text: "Approved." };

  test("a repeated sendId is never sent twice", () => {
    const first = beginSend(undefined, base);
    expect(first.send).toBe(true);
    const second = beginSend(first.record, base);
    expect(second.send).toBe(false);
    expect(second.record.status).toBe("pending");
  });

  test("delivered is not resolved; only engine evidence closes it", () => {
    const delivered = markDelivered(beginSend(undefined, base).record);
    expect(delivered.status).toBe("delivered");
    expect(markResolved(delivered, "audit GATE_APPROVED").status).toBe("resolved");
  });

  test("a refusal is terminal and cannot be resolved", () => {
    const refused = markRefused(beginSend(undefined, base).record, "forbidden");
    expect(markResolved(refused, "audit row").status).toBe("refused");
  });

  test("an uncertain delivery stays uncertain until proven, then may resolve", () => {
    const uncertain = markUncertain(markDelivered(beginSend(undefined, base).record), "timeout");
    expect(uncertain.status).toBe("uncertain");
    expect(markResolved(uncertain, "audit row").status).toBe("uncertain");
  });

  test("a pending record cannot be closed as resolved", () => {
    const pending = beginSend(undefined, base).record;
    expect(markResolved(pending, "audit row").status).toBe("pending");
  });
});
