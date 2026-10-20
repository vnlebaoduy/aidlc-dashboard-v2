// Unit descriptions from the run's own unit-of-work.md (server/scan/unit-info.ts).

import { describe, expect, test } from "bun:test";
import { parseUnitInfo } from "../scan/unit-info";

const DOC = `# Unit of Work — FR-02

| Unit ID | Directory | Tên | Kind | Độ phức tạp | Triển khai |
|---------|-----------|-----|------|-------------|------------|
| U1 | \`u1-core\` | Walking skeleton | service | M | Embedded |
| U2 | \`u2-retry\` | Lỗi và retry | service | L | Embedded |

## U1 — \`u1-core\` (walking skeleton)

**Mô tả:** Lát cắt mỏng chạy hết đường tích hợp.

**Khối thuộc unit:**
- Mới: X

## U2 — \`u2-retry\`

**Mô tả:** Mọi nhánh không thành công.
`;

describe("unit-of-work.md", () => {
  test("title and complexity from the table, description from each unit's section", () => {
    expect(parseUnitInfo(DOC, ["u1-core", "u2-retry"])).toEqual({
      "u1-core": {
        title: "Walking skeleton",
        complexity: "M",
        description: "Lát cắt mỏng chạy hết đường tích hợp.",
      },
      "u2-retry": {
        title: "Lỗi và retry",
        complexity: "L",
        description: "Mọi nhánh không thành công.",
      },
    });
  });

  test("English labels read the same way", () => {
    const en =
      "| Unit | Directory | Name | Complexity |\n|---|---|---|---|\n| U1 | `a` | Core | S |\n\n## `a`\n**Description:** Does the core thing.\n";
    expect(parseUnitInfo(en, ["a"])).toEqual({
      a: { title: "Core", complexity: "S", description: "Does the core thing." },
    });
  });

  test("a description in one unit's section never leaks into the next", () => {
    const doc = "## U1 — `u1`\n**Mô tả:** one\n## U2 — `u2`\n**Khối:** none\n";
    expect(parseUnitInfo(doc, ["u1", "u2"])).toEqual({ u1: { description: "one" } });
  });

  test("units not in the roster are ignored; an unknown shape yields nothing", () => {
    expect(parseUnitInfo(DOC, ["u9-other"])).toEqual({});
    expect(parseUnitInfo("just prose, no table, no headings", ["u1-core"])).toEqual({});
  });
});
