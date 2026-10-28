// apps/kirocrew/ui/src/index.js
import { createElement as h, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
var BASE = "/api/apps/aidlc-ledger";
var card = {
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 8,
  padding: 16,
  maxWidth: 640
};
var muted = { color: "var(--muted-foreground, #4b5563)", fontSize: 13 };
function Figure({ label, value }) {
  return h("div", { style: { minWidth: 120 } }, h("div", { style: { ...muted, fontSize: 12, fontWeight: 500 } }, label), h("div", { style: { fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" } }, value));
}
function App() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/model`, { cache: "no-store", headers: { accept: "application/json" } }).then(async (res) => {
      const body = await res.json();
      if (!live)
        return;
      setState(res.ok ? { status: "ready", model: body } : { status: "refused", code: body?.error?.code });
    }).catch(() => live && setState({ status: "unreachable" }));
    return () => {
      live = false;
    };
  }, []);
  if (state.status === "loading")
    return h("p", { style: muted }, "Reading the run…");
  if (state.status === "unreachable")
    return h("p", { style: muted }, "The Ledger backend did not answer.");
  if (state.status === "refused") {
    const text = state.code === "no-workspace" ? "No workspace is selected yet. Pick an AI-DLC v2 workspace to read." : state.code === "not-a-workspace" ? "That path is not an AI-DLC v2 workspace." : "The run could not be read.";
    return h("p", { style: muted }, text);
  }
  const m = state.model;
  const stage = m.state.currentStageDisplay || m.state.currentStage || "—";
  return h("section", { style: { display: "grid", gap: 16, fontFamily: "inherit" } }, h("header", null, h("h1", { style: { fontSize: 24, fontWeight: 600, margin: 0 } }, m.identity.slug ?? m.identity.record), h("p", { style: { ...muted, margin: "4px 0 0" } }, `${m.state.lifecyclePhase} · ${stage}`)), h("div", { style: { ...card, display: "flex", flexWrap: "wrap", gap: 24 } }, h(Figure, { label: "complete", value: `${m.state.overallPct}%` }), h(Figure, { label: "blockers", value: m.blockers.length }), h(Figure, { label: "warnings", value: m.warnings.length }), h(Figure, { label: "events", value: m.totalEvents })), h("p", { style: muted }, "Read-only: this page never writes to the workspace."));
}
function mount(element) {
  const root = createRoot(element);
  root.render(h(App));
  return () => root.unmount();
}
export {
  mount
};
