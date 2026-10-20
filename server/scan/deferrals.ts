// The deferral ledger — decisions the run put off, and where each one is
// scheduled to be asked again.
//
// WHY THIS IS A PANEL OF ITS OWN, separate from the stage diary. The diary
// (`memory.md`, scan/memory-diary.ts) records what the orchestrator thought while
// it worked; this records what the *human* declined to decide. Those are different
// ledgers with different readers, and the second one is invisible today: a run can
// answer every one of its questions — zero blank `[Answer]:` markers, so the blocker
// panel reads clean — while carrying 230 unresolved items that later stages are
// contracted to ask about again. Measured on one completed real run (137.5h, 4,679
// audit blocks): **194 asks, 0 unanswered, 0 blockers — and 230 open items.**
// The two counts are independent, which is the whole reason for a second panel.
//
// THE CONTRACT. `## Assumptions & Open Questions` is mandated in every artifact by
// the engine's own stage protocol, which also states the consequence:
//
//     "When downstream work needs an unresolved item, ask a follow-up and record
//      the answer in the current stage's questions file."
//                              — .kiro/aidlc-common/protocols/stage-protocol.md
//
// So the re-ask is not a defect, it is the contract. What the run never shows is
// the ledger behind it, which is why "why are you asking me this again?" has no
// answer on screen.
//
// THE TABLE IS ONE SHAPE, NOT THE SHAPE. Measured across 51 sections in one run:
//
//   structured  39  `### Assumptions` (bullets) + `### Open questions` (a table)
//   flat        12  bullets directly under the H2, each tagged `[assumption]`
//
// Every structured section was in `inception/` or `construction/`; every flat one
// in `ideation/`. The structured table's header was `| 항목 | 배정 |` in 38 of 39,
// giving 245 rows / 230 unique items — the last column names the stage where the
// decision gets made.
//
// A SECOND RUN WROTE NO TABLE AT ALL, and reading only the table made the panel
// report zero on a tree carrying 15 open questions. Measured over its 24 sections
// (27 bullets, 0 table rows anywhere):
//
//   `### Open questions` bullets, `**OQ1**`-style ids        6   → items
//   flat bullets with an `**OQ-xx**` id, untagged            9   → items
//   flat bullets tagged `[assumption]`                       9   → assumptions
//   `### Assumptions` bullets, `**AS1**`-style ids           3   → assumptions
//   `None.`                                                 13  → declared empty
//
// So a bullet is placed by whichever marker THE ENGINE wrote — the `[assumption]`
// tag, then a bold `**OQ**`/`**AS**` ledger id, then the enclosing subsection
// heading. See flushBullet for the order and for why `### Assumptions` is not the
// mirror of `### Open questions`. A bullet carries no 배정 cell, so every item read
// this way is honestly `unassigned`: the owner on that tree lives in prose ("이후
// 설계(Domain/Contract)") or in tags that are not stage slugs (`[mob: quality]`,
// `[spec §11]`, `[ckb: C1]`), and rule 3 below forbids guessing from either.
// One section on that tree is still unread — a numbered list of prose assumptions
// with no id and no tag — which is why `sections` is now counted wherever the
// heading appears, not only where the parse succeeded.
//
// THREE RULES THAT KEEP THE READ HONEST:
//
//   1. Only a KNOWN slug becomes an owner. The 배정 cell is full of backticked
//      tokens that are not stages — `[F5]`, `P-1`, `U-7`, `NEW-헤더-목록`,
//      `C22`. Every candidate token is tested against this run's state.md slugs
//      first and the stage catalogue second, so an unrecognised cell reports
//      `unassigned` rather than inventing a stage. This is the same reason
//      scan/audit.ts consults the catalogue for `**Context**` attribution.
//   2. Owner status comes from the checkbox, not from phase order. `passed` means
//      every occurrence of that slug in state.md is `[x]`/`[S]`; `current` means one
//      is active/awaiting/revising. No ordering is inferred, so a run with a
//      hand-edited or unusual stage set is read as written.
//   3. The prose is not parsed for owners. A flat-shape bullet often names its
//      decision site in prose ("그 결정 단계는 `contract-design`이다") and on the one
//      tree measured it was right — 3 of 4 sampled bullets. Four samples is not a
//      contract, so assumptions are carried ownerless and the panel says so.
//
// WHAT WAS DELIBERATELY NOT PARSED. `stories.md` marks blocked acceptance criteria
// inline as `⏸ 판정 보류 — 선행 결정: <항목>`, 26 of them. It looks like a third
// shape, but 37 of the 40 `⏸` glyphs in the whole record are in user-stories files:
// it is one stage's local convention, not something the engine writes. Reading it
// would make this module depend on a shape the next run may not use.
//
// OWNER STATUS IS PER SLUG, NOT PER UNIT. Nine assignments on the measured run read
// `U4의 \`nfr-requirements\`` — the same stage slug in a different unit. The unit
// label in that cell (`U3`, `U4`) is not the unit dir name (`u3-plan-detail-server-
// render`), so pairing them would be guesswork; the slug's statuses are aggregated
// instead, and `passed` requires EVERY occurrence to be done or skipped. On this run
// all four units' copies were done, so the answer is the same either way — but a run
// parked mid-Construction would read one unit's open stage as `current`, which is the
// safe direction.
//
// WHAT IT COST TO READ. Every `.md` under the phase dirs is read whole, because
// whether an artifact carries the section is not knowable from its name: 115
// artifacts, 2.16MB, **~50ms warm** on the measured run — the same order as the rest
// of the scan put together, taking a full `assemble` on that tree to **~155ms**.
// Against a 60s poll that is still not worth a cache, but quote 155ms when judging a
// change here, not the 10ms figure from the smaller reference run.
//
// MEASURED OUTCOME on that run, for regression: 50 sections across 49 artifacts
// (one artifact carries two), 245 table rows → **230 unique items** after fan-in,
// 177 assumptions. Owners resolved to passed 88 · current 47 · ahead 50 ·
// nextCycle 13 · unassigned 32 · outOfScope 0.
//
// THERE IS NO CLOSE MARKER. When a later stage settles an item, the row simply
// stops appearing in that stage's artifacts — nothing is written to say "closed".
// So `passed` means "the stage this was assigned to has finished and we cannot see
// it being answered", never "this was dropped". The panel states that limit rather
// than presenting the count as a defect tally. Same reasoning as the unclosed
// rejection in scan/rework.ts: measure what the ledger says and name what it omits.
//
// Node fs only, never throws.

import * as fs from "node:fs";
import * as path from "node:path";
import type { StageStatus } from "./parser";

/** Where the decision an item was deferred to actually sits. */
export type OwnerStatus =
  /** The assigned stage is finished (or skipped) — no answer is visible. */
  | "passed"
  /** The assigned stage is the one the run is on right now. */
  | "current"
  /** The assigned stage has not started yet. */
  | "ahead"
  /** A real stage, but not one this run executes (absent from state.md). */
  | "outOfScope"
  /** Explicitly pushed past this run ("다음 차수" / "이후 차수"). */
  | "nextCycle"
  /** No stage could be resolved from the 배정 cell. */
  | "unassigned";

export const OWNER_STATUSES: OwnerStatus[] = [
  "passed",
  "current",
  "ahead",
  "outOfScope",
  "nextCycle",
  "unassigned",
];

/** One row of a `### Open questions` table. */
export interface DeferralItem {
  /** The 항목 cell, verbatim. */
  item: string;
  /** The 배정 cell, verbatim — kept whole because it carries registry ids too. */
  assignment: string;
  /** Stage slug resolved out of `assignment`, when one is known. */
  ownerStage?: string;
  ownerStatus: OwnerStatus;
  /** Phase / stage / unit of the artifact that recorded it. */
  phase: string;
  stage: string;
  unit?: string;
  /** Record-relative POSIX path of that artifact, for the 원문 link. */
  rel: string;
  /** Every artifact carrying this same item (fan-in), `rel` included. */
  sources: string[];
  /** Earliest mtime among `sources` — how long it has been outstanding. */
  since: string;
  /** Seconds outstanding at read time. Undefined when `since` is unparseable. */
  ageSec?: number;
}

/** One `[assumption]` bullet — unresolved, but with no assigned owner. */
export interface DeferralAssumption {
  text: string;
  phase: string;
  stage: string;
  unit?: string;
  rel: string;
  since: string;
  /**
   * The stage's own `## Assumption Confirmation` was answered `A. Accept assumptions`
   * and listed this assumption. Acceptance is per stage: a restatement in a stage that
   * never asked stays unconfirmed — no answer points at it.
   */
  accepted: boolean;
  /** The questions file holding that acceptance, when `accepted`. */
  acceptedIn?: string;
}

/** How far a group of restatements of one assumption has been confirmed. */
export type AssumptionGroupStatus = "accepted" | "partial" | "unconfirmed";

/**
 * One assumption as the reader means it: the same sentence restated across stages
 * (an engine habit — "API002 chờ C12 đồng thuận" appeared in 6 files of one run) is
 * one assumption, listed with every place it was written.
 */
export interface AssumptionGroup {
  /** The longest restatement — usually the original, fullest wording. */
  text: string;
  status: AssumptionGroupStatus;
  members: DeferralAssumption[];
}

export interface DeferralReport {
  /** Deduplicated open items, most-urgent owner status first. */
  items: DeferralItem[];
  /** Deduplicated assumptions (exact text), one per artifact restatement. */
  assumptions: DeferralAssumption[];
  /** `assumptions` grouped by wording, unconfirmed first. */
  assumptionGroups: AssumptionGroup[];
  counts: Record<OwnerStatus, number>;
  /**
   * Per-owner rollup, highest count first. `stage` is absent for the no-owner
   * buckets (`unassigned`, `nextCycle`) — this is a model, so it must not invent a
   * display name for them; the render layer already owns the Korean labels.
   */
  byOwner: { stage?: string; status: OwnerStatus; count: number }[];
  /** Artifacts read. */
  artifacts: number;
  /** Artifacts carrying the mandated section. */
  sections: number;
  /** Sections whose body held only `None.` — an explicit "nothing open". */
  emptySections: number;
  /** Table rows read before fan-in dedup. */
  rows: number;
  /** True when no stage catalogue widened the slug oracle beyond state.md. */
  catalogMissing: boolean;
}

/** The phase dirs a record can hold (mirrors PHASES in the engine's lib). */
const PHASE_DIRS = ["initialization", "ideation", "inception", "construction", "operation"];

/** `## Assumptions & Open Questions`, at H2 or H3 (both observed). */
const SECTION_RE = /^(#{2,3})\s+Assumptions\s*&\s*Open\s*Questions\s*$/i;
/** Any subsection heading inside it. */
const SUB_RE = /^#{3,4}\s+(.*?)\s*$/;
const OPEN_SUB_RE = /open\s*questions?/i;
const ASSUMPTIONS_SUB_RE = /^assumptions?$/i;
/** A markdown table's `| --- | --- |` separator, which is what ends the header. */
const TABLE_SEP_RE = /^\s*\|[\s:|-]*-{2,}[\s:|-]*\|?\s*$/;
const TABLE_ROW_RE = /^\s*\|(.*?)\|?\s*$/;
/** An explicit "nothing open" body. */
const NONE_RE = /^(?:none|n\/a|not applicable|없음|해당\s*없음)[.!。]?$/i;
/** The engine writes the tag inside backticks (`` `[assumption]` ``); accept both. */
const ASSUMPTION_TAG_RE = /`?\[assumption\]`?/i;
/**
 * A list item — `-`/`*`/`+` and ordered markers, all four observed in the wild.
 * Group 1 is the indent, which decides whether a bullet is a ledger entry or a
 * detail hanging off one; group 2 is the text.
 */
const LIST_ITEM_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
/** Just the marker, for stripping it off a line before the `None.` test. */
const LIST_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
/**
 * The ledger id the engine writes in bold at the head of a bullet — `**OQ1**`,
 * `**OQ-US4**`, `**AS3**`. Group 1 is the whole id, group 2 the kind: `OQ` is an
 * open question, `AS` an assumption. This is a marker the engine wrote, not a
 * reading of the prose, which is why it is allowed to classify a bullet.
 *
 * Case-sensitive, and **at least one digit is required**. Without either, this
 * pattern reads ordinary bold-led prose as a ledger entry: `**ASSUMPTIONS**`,
 * `**AS-IS**` and `**Asset**` all matched an earlier `(OQ|AS)[-.A-Za-z0-9]*` form
 * and invented an assumption apiece. The engine writes ids uppercase and numbered
 * (`FR-1`, `ENT-001`, `BR1.1` are its own examples), so demanding a digit costs
 * nothing real and closes the whole class.
 */
const LEDGER_ID_RE = /^\*\*((OQ|AS)[A-Z0-9.-]*\d[A-Z0-9.-]*[a-z]?)\*\*/;
/** A kebab-case stage slug: at least two lowercase segments. */
const SLUG_TOKEN_RE = /[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g;
const NEXT_CYCLE_RE = /(?:다음|이후|차기)\s*차수|next\s+cycle|이번\s*차수\s*밖/i;

/** One artifact's parsed sections, before they are placed in the record tree. */
interface ParsedSection {
  rows: { item: string; assignment: string }[];
  assumptions: string[];
  /** How many sections the artifact held — one artifact can carry two. */
  sections: number;
  /**
   * True when a section was present and said only `None.` — the engine's explicit
   * "nothing open here". Worth keeping distinct from "no section at all", which is
   * silence rather than a claim.
   */
  declaredNone: boolean;
}

function splitRow(line: string): string[] {
  const m = TABLE_ROW_RE.exec(line);
  if (!m) return [];
  return (m[1] ?? "").split("|").map((c) => c.trim());
}

function tidy(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ---- assumption confirmation ------------------------------------------------
//
// THE ENGINE ASKS, ONCE PER STAGE. A stage that leaves `[assumption]`s in its artifacts
// must open `## Assumption Confirmation` in its questions file, list every assumption,
// and offer `A. Accept assumptions` / `B. Convert to follow-up questions`
// (`stages/ideation/intent-capture.md` Step 5). On Accept the `[assumption]` labels are
// RETAINED — "Acceptance does not turn an assumption into fact" — so reading the
// artifact alone cannot tell an accepted assumption from one nobody looked at. That is
// why the ledger used to report every one as "unconfirmed — unassigned".
//
// The answer is a literal the engine compares (`org.md`, preserved tokens), but people
// type around it: the measured run has `[Answer]: A. Accept assumptions A`. So the
// value is matched on its LEAD — `A`, `A.`, `A. Accept…`, `Accept assumptions` — and
// anything that leads with `B` or "Convert" is not acceptance.
//
// WHICH ASSUMPTIONS IT COVERS. The section lists them in its own words, numbered or
// bulleted, and the artifacts restate them with different wording (measured: the
// confirmation said "Phần consume/filter message Kafka đã tồn tại trong …", the
// artifact "Phần consume/filter message từ Kafka (topic giao dịch tiền về) đã tồn tại
// …"). So coverage is decided by word overlap (`sameAssumption`), and ONLY within the
// stage that asked: a restatement in scope-definition is not covered by an answer
// given in intent-capture. No answer points at it, and calling it accepted would be
// the dashboard deciding for the reader.

const CONFIRMATION_RE = /^#{2,3}\s+(?:\S+\s+)?Assumption\s+Confirmation\s*$/i;
const ANSWER_LINE_RE = /^\s*\[Answer\]:\s*(.*)$/;
/** `A`, `A.`, `A. Accept assumptions`, `Accept assumptions` — not `B …`, not `Convert`. */
const ACCEPT_RE = /^(?:a(?:[.)\s:—–-]|$)|accept\b)/i;

/** One stage's confirmation: whether it was accepted, and the assumptions it listed. */
export interface AssumptionConfirmation {
  accepted: boolean;
  /** The listed assumptions, verbatim (tag and list marker removed). */
  listed: string[];
}

/**
 * Read `## Assumption Confirmation` from a questions file. Exported for tests.
 * Undefined when the file has no such section. The answer is the first non-empty
 * `[Answer]:` in the section (blank-then-filled is how people answer); the two option
 * lines are scaffolding, not assumptions.
 */
export function parseAssumptionConfirmation(text: string): AssumptionConfirmation | undefined {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => CONFIRMATION_RE.test(l));
  if (start < 0) return undefined;
  const level = /^(#+)/.exec(lines[start] ?? "")?.[1]?.length ?? 2;
  const endRe = new RegExp(`^#{1,${level}}\\s`);
  const listed: string[] = [];
  let answer = "";
  let current: string | undefined;
  const flush = () => {
    if (current !== undefined) {
      const t = tidy(current.replace(ASSUMPTION_TAG_RE, ""));
      // The option lines are scaffolding. Both start with their letter; matching the
      // fixed English words keeps a listed assumption that happens to start "A." safe.
      if (t && !/^[AB]\.\s+(?:accept assumptions|convert to follow-up questions)/i.test(t)) {
        listed.push(t);
      }
    }
    current = undefined;
  };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (endRe.test(line) || /^---\s*$/.test(line)) break;
    const a = ANSWER_LINE_RE.exec(line);
    if (a) {
      flush();
      if (!answer) answer = tidy(a[1] ?? "");
      continue;
    }
    const li = LIST_ITEM_RE.exec(line);
    if (li && (li[1] ?? "").length === 0) {
      flush();
      current = li[2] ?? "";
      continue;
    }
    if (current !== undefined && /^\s+\S/.test(line)) {
      current = `${current} ${line.trim()}`;
      continue;
    }
    flush();
  }
  flush();
  return { accepted: ACCEPT_RE.test(answer), listed };
}

/** Content words of a sentence: provenance tags (`[Q3]`, `[intent]`) and short words out. */
function words(text: string): Set<string> {
  const bare = text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  return new Set(bare.split(" ").filter((w) => w.length >= 3));
}

/**
 * True when two sentences state the same assumption: at least 60% of the SHORTER
 * one's content words appear in the longer one. Overlap against the shorter side,
 * not Jaccard, because a restatement is usually a shortening ("Consume/filter Kafka
 * đã có sẵn." vs the original full sentence). Measured on the run that prompted this:
 * 15 restatements fell into 7 groups with no cross-topic merge at 0.6. Sentences
 * under three content words never match — too little to judge.
 */
export function sameAssumption(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  const small = Math.min(x.size, y.size);
  if (small < 3) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / small >= 0.6;
}

/**
 * Group restatements of one assumption. COMPLETE-link: a sentence joins a group only
 * when it is `sameAssumption` with EVERY member, else it starts its own. Single-link
 * was tried first and failed on the real run: approval-handoff's summary sentence
 * ("API002 chờ C12…; ngưỡng… chốt ở NFR; consume/filter Kafka đã có") overlaps each
 * topic, so it chained three different assumptions into one group of 12.
 * Unconfirmed groups first, then partial, then accepted; within a status, the order
 * the run wrote them.
 */
export function groupAssumptions(list: DeferralAssumption[]): AssumptionGroup[] {
  const groups: DeferralAssumption[][] = [];
  for (const a of list) {
    const home = groups.find((g) => g.every((m) => sameAssumption(m.text, a.text)));
    if (home) home.push(a);
    else groups.push([a]);
  }
  const rank: Record<AssumptionGroupStatus, number> = { unconfirmed: 0, partial: 1, accepted: 2 };
  return groups
    .map((members) => {
      const ok = members.filter((m) => m.accepted).length;
      const status: AssumptionGroupStatus =
        ok === members.length ? "accepted" : ok > 0 ? "partial" : "unconfirmed";
      const text = members.reduce((l, m) => (m.text.length > l.length ? m.text : l), "");
      return { text, status, members };
    })
    .map((g, order) => ({ g, order }))
    .sort((a, b) => rank[a.g.status] - rank[b.g.status] || a.order - b.order)
    .map(({ g }) => g);
}

/**
 * Parse every `## Assumptions & Open Questions` section in one artifact's text.
 * Exported for tests: both shapes and all three honesty rules are checkable from
 * a string, with no filesystem involved.
 *
 * A section ends at the next heading of its own level or higher, so an H3
 * subsection stays inside it. Inside a `### Open questions` subsection, table rows
 * are taken only AFTER the `|---|` separator — without that guard the header row
 * itself becomes an open item called "항목".
 */
export function parseDeferralSections(text: string): ParsedSection {
  const out: ParsedSection = { rows: [], assumptions: [], sections: 0, declaredNone: false };
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const head = SECTION_RE.exec(lines[i] ?? "");
    if (!head) continue;
    out.sections++;
    const level = (head[1] ?? "##").length;
    const endRe = new RegExp(`^#{1,${level}}\\s`);

    let sub: "open" | "assumptions" | "other" | undefined;
    let pastSeparator = false;
    let bullet: string | undefined;
    /** Indent of the line that opened `bullet` — 0 is a ledger entry, more is detail. */
    let bulletIndent = 0;
    /** Non-blank body lines, and how many of them were an explicit "nothing". */
    let bodyLines = 0;
    let noneLines = 0;
    const rowsBefore = out.rows.length;
    const assumptionsBefore = out.assumptions.length;

    /**
     * Place one finished bullet in the right ledger, or drop it. Three engine-written
     * signals decide, in this order — none of them is a reading of the prose:
     *
     *   1. `[assumption]` → an assumption. The tag is the engine's own marker and it
     *      wins outright, so a bullet that has always been read as a 전제 keeps being
     *      one even when it also carries an `OQ` id (5 such on the tree that forced
     *      this widening — an engine slip, not something to reclassify silently).
     *   2. A bold ledger id — `**OQ1**` → open question, `**AS1**` → assumption.
     *   3. Failing an id, a TOP-LEVEL bullet under `### Open questions` → open
     *      question. The heading is a declaration; `### Assumptions` deliberately is
     *      NOT the mirror of it, because an untagged idless bullet there was measured
     *      to be prose ("태그가 없는 불릿은 전제가 아니다"). This is the loosest of the
     *      three signals, so it is the one that checks indent: a nested bullet is a
     *      detail of the entry above it, and counting it split one decision into three.
     *
     * Anything else is dropped, as before. A `None.` sentinel is dropped whatever
     * shape it arrives in — the engine writes it to say the ledger is EMPTY, so
     * admitting `- None.` as an item both invents a decision named "None." and, by
     * making the section non-empty, hides the declaration it was making.
     */
    const flushBullet = () => {
      const b = bullet;
      bullet = undefined;
      if (b === undefined) return;
      if (ASSUMPTION_TAG_RE.test(b)) {
        const t = tidy(b.replace(ASSUMPTION_TAG_RE, ""));
        if (t.length > 0) out.assumptions.push(t);
        return;
      }
      if (NONE_RE.test(tidy(b))) return;
      const id = LEDGER_ID_RE.exec(b);
      const kind = id
        ? (id[2] ?? "") === "AS"
          ? "assumption"
          : "open"
        : sub === "open" && bulletIndent === 0
          ? "open"
          : undefined;
      if (kind === undefined) return;
      // Keep the id, drop its bold markers: `**OQ1** …` → `OQ1 …`. The id is how a
      // reader finds the row in the file and how sibling artifacts cross-reference it
      // (`[stories: OQ-US4]`), so stripping it would cost more than the asterisks do.
      const t = tidy(id ? b.replace(LEDGER_ID_RE, "$1") : b);
      if (t.length === 0) return;
      if (kind === "assumption") out.assumptions.push(t);
      // A bullet has no 배정 cell. Leave it empty rather than mining the prose or the
      // trailing bracket tags (`[mob: quality]`, `[spec §11]`) for an owner — they are
      // not stage slugs, so resolveOwner reports `unassigned`, which is the truth.
      else out.rows.push({ item: t, assignment: "" });
    };

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (endRe.test(line)) {
        i = j - 1;
        break;
      }
      const s = SUB_RE.exec(line);
      // Count content lines only — a subsection heading is structure, so a section
      // whose every content line is `None.` still reads as an explicit "nothing
      // open" even when the two mandated subsections are present.
      if (!s && line.trim().length > 0) {
        bodyLines++;
        if (NONE_RE.test(tidy(line.replace(LIST_MARKER_RE, "")))) noneLines++;
      }
      if (s) {
        flushBullet();
        const name = (s[1] ?? "").trim();
        sub = OPEN_SUB_RE.test(name)
          ? "open"
          : ASSUMPTIONS_SUB_RE.test(name)
            ? "assumptions"
            : "other";
        pastSeparator = false;
        continue;
      }

      // A table row. Only the open-questions subsection contributes items; a table
      // under `### Assumptions` or an unrecognised subsection is left alone.
      if (line.trim().startsWith("|")) {
        flushBullet();
        if (sub !== "open") continue;
        if (TABLE_SEP_RE.test(line)) {
          pastSeparator = true;
          continue;
        }
        if (!pastSeparator) continue;
        const cells = splitRow(line);
        // First cell is the item, LAST is the assignment: the mandated shape has
        // two columns, but a stage that adds a "why can't we judge it" column in
        // the middle still names the decision site last.
        const item = tidy(cells[0] ?? "");
        const assignment = tidy(cells[cells.length - 1] ?? "");
        if (item.length === 0 || cells.length < 2) continue;
        out.rows.push({ item, assignment });
        continue;
      }

      // Bullets. flushBullet decides which ledger each one lands in; a bullet's
      // continuation lines are folded in here so a wrapped sentence stays whole.
      const b = LIST_ITEM_RE.exec(line);
      if (b) {
        flushBullet();
        bulletIndent = (b[1] ?? "").length;
        bullet = b[2] ?? "";
        continue;
      }
      if (bullet !== undefined && /^\s+\S/.test(line)) {
        bullet = `${bullet} ${line.trim()}`;
        continue;
      }
      flushBullet();
    }
    flushBullet();
    if (
      out.rows.length === rowsBefore &&
      out.assumptions.length === assumptionsBefore &&
      bodyLines > 0 &&
      noneLines === bodyLines
    ) {
      out.declaredNone = true;
    }
  }
  return out;
}

/**
 * Resolve the 배정 cell to a stage and a status. Only a slug the run itself knows
 * (state.md) or the catalogue lists becomes an owner — see rule 1 in the header.
 */
export function resolveOwner(
  assignment: string,
  stageStatuses: Map<string, StageStatus[]>,
  catalogSlugs?: Set<string>,
): { ownerStage?: string; ownerStatus: OwnerStatus } {
  const tokens = assignment.match(SLUG_TOKEN_RE) ?? [];
  for (const token of tokens) {
    const inState = stageStatuses.get(token);
    if (inState && inState.length > 0) {
      if (inState.some((s) => s === "active" || s === "awaiting" || s === "revising")) {
        return { ownerStage: token, ownerStatus: "current" };
      }
      if (inState.every((s) => s === "done" || s === "skipped")) {
        return { ownerStage: token, ownerStatus: "passed" };
      }
      return { ownerStage: token, ownerStatus: "ahead" };
    }
    if (catalogSlugs?.has(token)) return { ownerStage: token, ownerStatus: "outOfScope" };
  }
  if (NEXT_CYCLE_RE.test(assignment)) return { ownerStatus: "nextCycle" };
  return { ownerStatus: "unassigned" };
}

function statMtime(p: string): string {
  try {
    return fs
      .statSync(p)
      .mtime.toISOString()
      .replace(/\.\d{3}Z$/, "Z");
  } catch {
    return "";
  }
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readDir(p: string): string[] {
  try {
    return fs.readdirSync(p).sort();
  } catch {
    return [];
  }
}

/** One artifact location in the record tree. */
interface Located {
  relParts: string[];
  phase: string;
  stage: string;
  unit?: string;
}

/**
 * Collect every `.md` artifact under the record's phase dirs, tagged with the
 * stage that wrote it.
 *
 * A stage dir can hold a subdirectory of its own (`practices-discovery/
 * contributions/`), which is the same two-shapes-per-depth problem
 * `**Context**` attribution has in scan/audit.ts — so when a catalogue is
 * available its `isStage` oracle decides, and only without one does the reader
 * fall back to "a dir with subdirs is a unit".
 */
function locateArtifacts(recordDir: string, isStage?: (slug: string) => boolean): Located[] {
  const out: Located[] = [];
  const scanFiles = (
    relParts: string[],
    phase: string,
    stage: string,
    unit: string | undefined,
    descend: boolean,
  ) => {
    for (const f of readDir(path.join(recordDir, ...relParts))) {
      const abs = path.join(recordDir, ...relParts, f);
      if (f.endsWith(".md")) {
        out.push({ relParts: [...relParts, f], phase, stage, unit });
        continue;
      }
      // One level of stage-owned subdirectory (`contributions/`), same stage. Only
      // from a stage dir: descending from a UNIT dir would collect every stage's
      // files a second time, which double-counts the whole ledger.
      if (descend && isDir(abs)) {
        for (const g of readDir(abs)) {
          if (g.endsWith(".md")) out.push({ relParts: [...relParts, f, g], phase, stage, unit });
        }
      }
    }
  };

  for (const phase of PHASE_DIRS) {
    const phaseAbs = path.join(recordDir, phase);
    if (!isDir(phaseAbs)) continue;
    for (const child of readDir(phaseAbs)) {
      const childAbs = path.join(phaseAbs, child);
      if (!isDir(childAbs)) continue;
      const subdirs = readDir(childAbs).filter((g) => isDir(path.join(childAbs, g)));
      const childIsStage = isStage ? isStage(child) : subdirs.length === 0;
      if (!childIsStage && subdirs.length > 0) {
        // Unit dir: its stage children are stages.
        for (const stage of subdirs) scanFiles([phase, child, stage], phase, stage, child, true);
        scanFiles([phase, child], phase, child, undefined, false);
      } else {
        scanFiles([phase, child], phase, child, undefined, true);
      }
    }
  }
  return out;
}

/** Sort key: the statuses a reader has to act on first. */
const STATUS_RANK: Record<OwnerStatus, number> = {
  passed: 0,
  current: 1,
  ahead: 2,
  unassigned: 3,
  outOfScope: 4,
  nextCycle: 5,
};

export interface DeferralOptions {
  /** Per-slug checkbox states from state.md — how owner status is decided. */
  stageStatuses?: Map<string, StageStatus[]>;
  /** Stage slugs the catalogue lists, for recognising out-of-scope owners. */
  catalogSlugs?: Set<string>;
  /** `isStage` oracle for the unit-vs-stage depth ambiguity. */
  isStage?: (slug: string) => boolean;
  /** Read clock, for ages. Defaults to now. */
  now?: string;
}

/**
 * Read the record's deferral ledger. Never throws: an unreadable artifact is
 * skipped, and a record with no such sections yields an empty report rather than
 * an error.
 */
export function readDeferrals(recordDir: string, opts: DeferralOptions = {}): DeferralReport {
  const stageStatuses = opts.stageStatuses ?? new Map<string, StageStatus[]>();
  const nowMs = Date.parse(opts.now ?? new Date().toISOString());

  const located = locateArtifacts(recordDir, opts.isStage);
  let sections = 0;
  let emptySections = 0;
  let rows = 0;

  // Fan-in: the same item is often restated by a downstream artifact. Keyed on the
  // item text so the ledger counts decisions, not mentions; the earliest source
  // wins `since`, because that is when the deferral actually started.
  const byItem = new Map<string, DeferralItem>();
  const assumptions = new Map<string, DeferralAssumption>();
  // Per stage dir (`<phase>/[<unit>/]<stage>`): its questions file's confirmation, read
  // once. The questions file is located by the same walk, so it shares the dir rules.
  const confirmations = new Map<string, { rel: string; c: AssumptionConfirmation }>();
  for (const loc of located) {
    const name = loc.relParts[loc.relParts.length - 1] ?? "";
    if (!name.endsWith("-questions.md")) continue;
    let qtext: string;
    try {
      qtext = fs.readFileSync(path.join(recordDir, ...loc.relParts), "utf-8");
    } catch {
      continue;
    }
    const c = parseAssumptionConfirmation(qtext);
    if (c)
      confirmations.set(loc.relParts.slice(0, -1).join("/"), { rel: loc.relParts.join("/"), c });
  }

  for (const loc of located) {
    const abs = path.join(recordDir, ...loc.relParts);
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    // Cheap reject before the line walk: most artifacts do not carry the section.
    if (!/Assumptions\s*&\s*Open\s*Questions/i.test(text)) continue;
    const parsed = parseDeferralSections(text);
    // Count the section wherever it appears, before deciding what came out of it.
    // Gating the tally on a successful read understated the denominator by exactly
    // the sections whose shape this reader does not cover, so the panel's own header
    // hid the gap it was reporting.
    sections += parsed.sections;
    const found = parsed.rows.length > 0 || parsed.assumptions.length > 0;
    if (!found) {
      // Only an explicit `None.` is an empty section; a section this reader simply
      // could not parse is not the engine claiming there is nothing open.
      if (parsed.declaredNone) emptySections++;
      continue;
    }
    const rel = loc.relParts.join("/");
    const since = statMtime(abs);

    for (const row of parsed.rows) {
      rows++;
      const key = row.item.toLowerCase();
      const existing = byItem.get(key);
      if (existing) {
        existing.sources.push(rel);
        if (since && (!existing.since || since < existing.since)) existing.since = since;
        continue;
      }
      const owner = resolveOwner(row.assignment, stageStatuses, opts.catalogSlugs);
      byItem.set(key, {
        item: row.item,
        assignment: row.assignment,
        ownerStage: owner.ownerStage,
        ownerStatus: owner.ownerStatus,
        phase: loc.phase,
        stage: loc.stage,
        unit: loc.unit,
        rel,
        sources: [rel],
        since,
      });
    }

    // The stage dir this artifact sits in. A `contributions/` subdir file belongs to
    // the stage above it, the same rule locateArtifacts applies.
    const stageDir = (loc.unit ? [loc.phase, loc.unit, loc.stage] : [loc.phase, loc.stage]).join(
      "/",
    );
    const confirmation = confirmations.get(stageDir);
    for (const text2 of parsed.assumptions) {
      const key = text2.toLowerCase();
      if (assumptions.has(key)) continue;
      const accepted =
        confirmation?.c.accepted === true &&
        confirmation.c.listed.some((l) => sameAssumption(l, text2));
      assumptions.set(key, {
        text: text2,
        phase: loc.phase,
        stage: loc.stage,
        unit: loc.unit,
        rel,
        since,
        accepted,
        acceptedIn: accepted ? confirmation?.rel : undefined,
      });
    }
  }

  const items = [...byItem.values()];
  for (const it of items) {
    const parsedTs = Date.parse(it.since);
    it.ageSec = Number.isFinite(parsedTs) ? Math.max(0, (nowMs - parsedTs) / 1000) : undefined;
  }
  items.sort(
    (a, b) =>
      STATUS_RANK[a.ownerStatus] - STATUS_RANK[b.ownerStatus] ||
      (a.since < b.since ? -1 : a.since > b.since ? 1 : 0) ||
      a.item.localeCompare(b.item),
  );

  const counts = Object.fromEntries(OWNER_STATUSES.map((s) => [s, 0])) as Record<
    OwnerStatus,
    number
  >;
  for (const it of items) counts[it.ownerStatus]++;

  const ownerRollup = new Map<string, { stage?: string; status: OwnerStatus; count: number }>();
  for (const it of items) {
    // A no-owner bucket is keyed on its status, and carries NO stage — the previous
    // `(${status})` placeholder was a display string built in the scan layer, and it
    // reached the screen verbatim as a row labelled `(unassigned)` in a Korean UI.
    // Prefixed so a bucket key can never collide with a real stage slug (no slug holds
    // a `:`). It was a literal NUL byte for exactly one commit, which made the leak
    // audit classify this whole file as binary and skip it — it said so, and the
    // "119/122개 검사" line was read as normal. Keep source bytes printable.
    const key = it.ownerStage ?? `status:${it.ownerStatus}`;
    const row = ownerRollup.get(key);
    if (row) row.count++;
    else ownerRollup.set(key, { stage: it.ownerStage, status: it.ownerStatus, count: 1 });
  }

  const assumptionList = [...assumptions.values()];
  return {
    items,
    assumptions: assumptionList,
    assumptionGroups: groupAssumptions(assumptionList),
    counts,
    byOwner: [...ownerRollup.values()].sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.count - a.count ||
        (a.stage ?? "").localeCompare(b.stage ?? ""),
    ),
    artifacts: located.length,
    sections,
    emptySections,
    rows,
    catalogMissing: opts.catalogSlugs === undefined,
  };
}
