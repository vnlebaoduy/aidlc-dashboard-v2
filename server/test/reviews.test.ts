import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readReviews } from "../scan/reviews";

const dirs: string[] = [];

function tempRecord(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-reviews-"));
  dirs.push(dir);
  return dir;
}

function writeReview(record: string, rel: string, body: string): void {
  const full = path.join(record, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

const READY = `## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 2
**Verdict Dictated:** no

### Findings

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| R-01 | Fixed | high | closed |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| low | api.md | wording | tighten |
`;

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readReviews", () => {
  test("reads the ownership lines, the findings count and the viewer path", () => {
    const record = tempRecord();
    writeReview(record, "inception/requirements-analysis/reviews/review-01.md", READY);

    const reviews = readReviews(record);
    expect(reviews).toHaveLength(1);
    const review = reviews?.[0];
    expect(review?.stage).toBe("requirements-analysis");
    expect(review?.number).toBe(1);
    expect(review?.verdict).toBe("READY");
    expect(review?.reviewer).toBe("aidlc-architecture-reviewer-agent");
    expect(review?.iteration).toBe("2");
    expect(review?.findings).toBe(1);
    expect(review?.rel).toBe("inception/requirements-analysis/reviews/review-01.md");
  });

  test("keeps the Unit for a Construction review and orders by number", () => {
    const record = tempRecord();
    writeReview(record, "construction/PU-A-core/functional-design/reviews/review-02.md", READY);
    writeReview(
      record,
      "construction/PU-A-core/functional-design/reviews/review-01.md",
      READY.replace("READY", "NOT-READY"),
    );

    const reviews = readReviews(record);
    expect(reviews?.map((r) => `${r.unit}/${r.stage}/${r.number}`)).toEqual([
      "PU-A-core/functional-design/1",
      "PU-A-core/functional-design/2",
    ]);
    expect(reviews?.[0]?.verdict).toBe("NOT-READY");
  });

  test("an unreadable verdict line is left undefined, never guessed", () => {
    const record = tempRecord();
    writeReview(record, "ideation/feasibility/reviews/review-01.md", "**Verdict:** MAYBE\n");
    expect(readReviews(record)?.[0]?.verdict).toBeUndefined();
  });

  test("no reviews directory means absence", () => {
    expect(readReviews(tempRecord())).toBeUndefined();
  });
});
