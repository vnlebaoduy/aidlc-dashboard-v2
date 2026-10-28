import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { assemble } from "../../../../server/model/assemble";
import { createElement } from "react";
import LedgerPage, { App } from "../src/index.js";

// The host shell is not on this machine, so the page logic is proven where it can
// be: the same component tree, server-rendered against the reference fixture. This
// covers data mapping and the empty/absent branches; it does not prove host chrome.

const root = path.join(import.meta.dir, "..", "..", "..", "..", "fixtures", "reference");
const model = assemble(root);

function render(tab) {
  return renderToStaticMarkup(App({ model, tab }));
}

describe("AI-DLC Ledger pages", () => {
  test("overview shows the run identity, progress and the needs-you list", () => {
    const html = render("overview");
    expect(html).toContain(model.identity.slug ?? model.identity.record);
    expect(html).toContain(`${model.state.overallPct}%`);
    expect(html).toContain("Needs you");
  });

  test("stages lists phases with a status word, never colour alone", () => {
    const html = render("stages");
    expect(html).toContain("Construction");
    expect(html).toMatch(/done|active|awaiting approval|pending|skipped/);
    expect(html).toContain("files");
  });

  test("timeline renders stage spans with a duration", () => {
    const html = render("timeline");
    expect(html).toContain("Where the time went");
    expect(html).toContain(model.timing.stages[0].stage);
  });

  test("decisions reports the ledger counts even when empty", () => {
    const html = render("decisions");
    expect(html).toContain("open items");
    expect(html).toContain("assumptions");
  });

  test("sources names the absent planes instead of pretending they are healthy", () => {
    const html = render("sources");
    expect(html).toContain("Freshness of each input");
    expect(html).toContain("runtime-graph");
    expect(html).toContain("Read-only");
  });

  test("an open gate gets the answer panel with a disabled send until a session maps", () => {
    const gated = { ...model, gates: { ...model.gates, awaitingStage: "code-generation" } };
    const html = renderToStaticMarkup(App({ model: gated, tab: "decisions" }));
    expect(html).toContain("Answer the open gate");
    expect(html).toContain("Looking for this workspace");
    expect(html).toContain("disabled");
  });

  test("the default export is the page component the host renders", () => {
    const html = renderToStaticMarkup(createElement(LedgerPage));
    expect(html).toContain("Reading the run");
  });

  test("a model without optional planes still renders every tab", () => {
    const bare = {
      ...model,
      runtime: undefined,
      signals: undefined,
      knowledge: undefined,
      reviews: undefined,
      plan: undefined,
      plugins: undefined,
      intents: undefined,
      spaces: undefined,
      phaseChecks: undefined,
    };
    for (const tab of ["overview", "stages", "timeline", "decisions", "sources"]) {
      expect(renderToStaticMarkup(App({ model: bare, tab }))).toContain("Read-only");
    }
  });
});
