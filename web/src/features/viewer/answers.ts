// Question files record each reply as a line of its own: `[Answer]: A`.
//
// CommonMark reads such a line as a LINK REFERENCE DEFINITION (label "Answer", URL "A")
// and renders nothing, so every single-token answer (`A`, `a,b`, `a+b+c`) vanished from
// the preview while multi-word ones (`Looks correct`) showed — and in a file holding
// both, the multi-word `[Answer]` even became a link to the first definition. This pass,
// run on the markdown AST before it becomes HTML:
//
// 1. puts back, verbatim from the source, every definition no `[text][label]` uses
//    (`[Answer]`, `[Approval Fingerprint]` …) and every `[Answer]` reference, so the
//    line the author wrote is the line the reader sees;
// 2. marks a non-empty `[Answer]:` paragraph so the preview can set it apart;
// 3. marks the chosen option, only when the answer is unambiguous: option letters that
//    all exist in the nearest `A. … / B. …` block, or the exact text of a list item
//    (`- Looks correct`). Anything else (free text, `Approve Plan`) shows the answer
//    only — a wrong highlight is worse than none.
//
// Pure (no DOM, no React), so it is tested from server/test.

import type { Nodes, Paragraph, Parent, PhrasingContent, Root, RootContent } from "mdast";
// Type-only: brings the `data.hName` / `data.hProperties` augmentation of mdast.
import type {} from "mdast-util-to-hast";

const ANSWER = /^\[Answer\]:[ \t]*(.*)/;
const OPTION_LINE = /^([A-Z])\.\s/;
/** `A`, `a,b`, `A + B`, `A, D,E`, then the end or punctuation (`A — …`, `X. Other…`,
 *  `X: …`). A word after the letters (`A long answer`) means prose, not a choice. */
const LETTERS = /^([A-Za-z](?:\s*[,+&]\s*[A-Za-z])*)(?=\s*$|\s*[.:(—–-])/;
/** mdast identifiers are normalised to lower case. */
const ANSWER_ID = "answer";

function plain(node: Nodes): string {
  if ("value" in node) return node.value;
  if (node.type === "break") return "\n";
  return "children" in node ? node.children.map(plain).join("") : "";
}

/** Labels a real `[text][label]` points at, except `[Answer]`, which is never a link. */
function referenced(node: Nodes, out: Set<string>): Set<string> {
  if (
    (node.type === "linkReference" || node.type === "imageReference") &&
    node.identifier !== ANSWER_ID
  ) {
    out.add(node.identifier);
  }
  if ("children" in node) for (const c of node.children) referenced(c, out);
  return out;
}

/** The node's own source text, or undefined when the parser left no offsets. */
function slice(node: Nodes, source: string): string | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : source.slice(start, end);
}

/** Split a paragraph's inline content at its line breaks. Null when a newline sits
 *  inside a nested inline (emphasis spanning lines): splitting that would be a guess. */
function lines(p: Paragraph): PhrasingContent[][] | null {
  const out: PhrasingContent[][] = [[]];
  for (const child of p.children) {
    if (child.type === "break") {
      out.push([]);
    } else if (child.type === "text") {
      child.value.split("\n").forEach((part, i) => {
        if (i > 0) out.push([]);
        if (part) out[out.length - 1]?.push({ type: "text", value: part });
      });
    } else if (plain(child).includes("\n")) {
      return null;
    } else {
      out[out.length - 1]?.push(child);
    }
  }
  return out.filter((l) => l.length > 0);
}

function markChoice(options: RootContent | undefined, value: string): void {
  if (options?.type === "list") {
    const want = value.toLowerCase();
    const item = options.children.find((li) => plain(li).trim().toLowerCase() === want);
    if (item) item.data = { ...item.data, hProperties: { dataChoice: "selected" } };
    return;
  }
  if (options?.type !== "paragraph") return;
  const picked = LETTERS.exec(value)?.[1]
    ?.toUpperCase()
    .split(/[\s,+&]+/);
  const split = picked ? lines(options) : null;
  if (!picked || !split) return;
  const letters = split.map(
    (children) => OPTION_LINE.exec(plain({ type: "paragraph", children }))?.[1],
  );
  if (!picked.every((x) => letters.includes(x))) return;
  // One element per option line, so a selected line can be styled on its own.
  options.children = split.map((children, i) => ({
    type: "emphasis",
    children,
    data: {
      hName: "span",
      hProperties: { dataChoice: picked.includes(letters[i] ?? "") ? "selected" : "option" },
    },
  }));
}

function restore(parent: Parent, keep: Set<string>, source: string): void {
  parent.children = parent.children.map((child) => {
    const text = slice(child, source);
    if (text === undefined) return child;
    if (child.type === "definition" && !keep.has(child.identifier)) {
      return { type: "paragraph", children: [{ type: "text", value: text }] };
    }
    if (child.type === "linkReference" && child.identifier === ANSWER_ID) {
      return { type: "text", value: text };
    }
    return child;
  }) as Parent["children"];
  for (const child of parent.children) {
    if ("children" in child) restore(child, keep, source);
  }
}

function mark(parent: Parent): void {
  let options: RootContent | undefined;
  for (const child of parent.children) {
    if (child.type === "heading") {
      options = undefined;
    } else if (child.type === "paragraph") {
      const text = plain(child);
      const value = ANSWER.exec(text.split("\n")[0] ?? "")?.[1]?.trim();
      if (value !== undefined) {
        if (value) {
          child.data = { ...child.data, hProperties: { dataAnswer: "given" } };
          markChoice(options, value);
        }
        options = undefined;
      } else if (OPTION_LINE.test(text)) {
        options = child;
      }
    } else if (child.type === "list") {
      options = child;
    }
    if (child.type !== "paragraph" && "children" in child) mark(child);
  }
}

/** The transform itself, exported for tests: `source` is the text the tree came from. */
export function showAnswers(tree: Root, source: string): void {
  restore(tree, referenced(tree, new Set()), source);
  mark(tree);
}

/** remark plugin wrapper around `showAnswers`. */
export function remarkAnswers() {
  return (tree: Root, file: { value: unknown }) => showAnswers(tree, String(file.value));
}
