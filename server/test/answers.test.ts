// `[Answer]: …` lines in question files (web/src/features/viewer/answers.ts).
// CommonMark parses `[Answer]: A` as a link definition and renders nothing; these tests
// run the real remark pipeline the preview uses, so a parser upgrade that changes that
// behaviour shows up here.
import { describe, expect, test } from "bun:test";
import type { Nodes, Root } from "../../web/node_modules/@types/mdast/index.d.ts";
import remarkBreaks from "../../web/node_modules/remark-breaks/index.js";
import remarkGfm from "../../web/node_modules/remark-gfm/index.js";
import remarkParse from "../../web/node_modules/remark-parse/index.js";
import { unified } from "../../web/node_modules/unified/index.js";
import { remarkAnswers } from "../../web/src/features/viewer/answers";

const pipeline = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks).use(remarkAnswers);

function tree(md: string): Root {
  return pipeline.runSync(pipeline.parse(md), md) as Root;
}

function text(node: Nodes): string {
  if ("value" in node) return node.value;
  return "children" in node ? node.children.map(text).join("") : "";
}

function find(node: Nodes, hit: (n: Nodes) => boolean, out: Nodes[] = []): Nodes[] {
  if (hit(node)) out.push(node);
  if ("children" in node) for (const c of node.children) find(c, hit, out);
  return out;
}

const answers = (t: Root) =>
  find(t, (n) => n.data?.hProperties?.dataAnswer === "given").map((n) => text(n));
const selected = (t: Root) =>
  find(t, (n) => n.data?.hProperties?.dataChoice === "selected").map((n) => text(n).trim());

const question = (answer: string) =>
  `## Q1. Kiểu của \`SoTien\`\n\nPick one.\n\nA. String\nB. Number\nC. Both\nX. Other (please specify)\n\n[Answer]: ${answer}\n`;

describe("question answers in the markdown preview", () => {
  test("a one-token answer is shown, not swallowed as a link definition", () => {
    const t = tree(question("A"));
    expect(find(t, (n) => n.type === "definition")).toHaveLength(0);
    expect(answers(t)).toEqual(["[Answer]: A"]);
    expect(selected(t)).toEqual(["A. String"]);
  });

  test("every listed letter is selected, whatever the separator or case", () => {
    expect(selected(tree(question("a,b")))).toEqual(["A. String", "B. Number"]);
    expect(selected(tree(question("a+b+c")))).toEqual(["A. String", "B. Number", "C. Both"]);
    expect(selected(tree(question("A, C")))).toEqual(["A. String", "C. Both"]);
    expect(selected(tree(question("X. Other (please specify): gọi lại")))).toEqual([
      "X. Other (please specify)",
    ]);
  });

  test("an answer that is not a clean option letter shows but highlights nothing", () => {
    for (const a of ["E", "Approve Plan", "Go", "A long free-text answer"]) {
      const t = tree(question(a));
      expect(answers(t)).toEqual([`[Answer]: ${a}`]);
      expect(selected(t)).toEqual([]);
    }
  });

  test("a list-style choice is matched on its exact text", () => {
    const md =
      "Does this look correct?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct\n";
    expect(selected(tree(md))).toEqual(["Looks correct"]);
    expect(selected(tree(md.replace("[Answer]: Looks correct", "[Answer]: Looks")))).toEqual([]);
  });

  test("a multi-word answer after a one-token one is not turned into a link", () => {
    const md = `${question("A")}\n## Q2\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct\n`;
    const t = tree(md);
    expect(find(t, (n) => n.type === "linkReference")).toHaveLength(0);
    expect(answers(t)).toEqual(["[Answer]: A", "[Answer]: Looks correct"]);
  });

  test("an empty answer is shown plainly, with no option highlighted", () => {
    const t = tree(question(""));
    expect(text(t)).toContain("[Answer]:");
    expect(answers(t)).toEqual([]);
    expect(selected(t)).toEqual([]);
  });

  test("a link definition that something references is left alone", () => {
    const t = tree("See [the spec][r].\n\n[r]: https://example.com\n");
    expect(find(t, (n) => n.type === "definition")).toHaveLength(1);
    expect(find(t, (n) => n.type === "linkReference")).toHaveLength(1);
  });
});
