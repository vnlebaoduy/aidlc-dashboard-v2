// apps/kirocrew/ui/src/index.js
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  FileTextIcon,
  GaugeIcon,
  ListTreeIcon
} from "lucide-react";
import { createElement as h, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
var BASE = "/api/apps/aidlc-ledger";
var T = {
  fg: "var(--foreground, #000000)",
  muted: "var(--muted-foreground, #4b5563)",
  border: "var(--border, #e5e7eb)",
  card: "var(--card, #ffffff)",
  primary: "var(--primary, #ffc708)",
  primaryFg: "#000000",
  success: "var(--success, #16a34a)",
  warning: "var(--warning, #f59e0b)",
  danger: "var(--destructive, #dc2626)",
  blue: "var(--brand-blue, #0070c9)"
};
var TABS = [
  ["overview", "Overview"],
  ["stages", "Stages & units"],
  ["timeline", "Timeline"],
  ["decisions", "Decisions"],
  ["sources", "Sources"]
];
function seconds(sec) {
  if (sec === undefined || sec === null)
    return "—";
  if (sec < 60)
    return `${Math.round(sec)}s`;
  if (sec < 3600)
    return `${Math.round(sec / 60)}m`;
  const hours = sec / 3600;
  return hours < 48 ? `${hours.toFixed(1)}h` : `${Math.round(hours / 24)}d`;
}
function cardStyle() {
  return { border: `1px solid ${T.border}`, background: T.card, borderRadius: 8, padding: 16 };
}
function Card({ title, children, tone }) {
  return h("section", { style: { ...cardStyle(), display: "grid", gap: 10, borderColor: tone ?? T.border } }, h("h2", { style: { margin: 0, fontSize: 16, fontWeight: 600 } }, title), children);
}
function Muted({ children }) {
  return h("p", { style: { margin: 0, color: T.muted, fontSize: 13, lineHeight: "20px" } }, children);
}
var STATUS = {
  done: [CircleCheckIcon, "done", T.success],
  active: [ClockIcon, "active", T.warning],
  awaiting: [CircleAlertIcon, "awaiting approval", T.warning],
  revising: [CircleAlertIcon, "revising", T.warning],
  skipped: [CircleXIcon, "skipped", T.muted],
  pending: [CircleAlertIcon, "pending", T.muted]
};
function Status({ status }) {
  const [Icon, word, colour] = STATUS[status] ?? STATUS.pending;
  return h("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      color: colour,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, h(Icon, { size: 14, "aria-hidden": true }), word);
}
function Figure({ label, value }) {
  return h("div", { style: { minWidth: 110 } }, h("div", { style: { color: T.muted, fontSize: 12, fontWeight: 500 } }, label), h("div", { style: { fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" } }, value));
}
function Overview({ m }) {
  const s = m.state;
  const stage = s.currentStageDisplay || s.currentStage || "—";
  const pendingGuard = (m.signals?.guardRefusals ?? []).filter((r) => r.pendingAsk);
  return h("div", { style: { display: "grid", gap: 16 } }, h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 } }, h("h1", { style: { margin: 0, fontSize: 24, fontWeight: 600 } }, m.identity.slug ?? m.identity.record), h(Muted, null, `${s.lifecyclePhase} · ${stage}`)), h("div", { style: { ...cardStyle(), display: "flex", flexWrap: "wrap", gap: 24 } }, h(Figure, { label: "complete", value: `${s.overallPct}%` }), h(Figure, { label: "blockers", value: m.blockers.length }), h(Figure, { label: "gates", value: `${m.gates.approved} / ${m.gates.rejected}` }), h(Figure, {
    label: "findings",
    value: (m.reviews ?? []).reduce((n, r) => n + (r.findings ?? 0), 0)
  })), pendingGuard.length > 0 ? h(Card, { title: "A guard is holding this run", tone: T.warning }, h("ul", { style: { margin: 0, paddingLeft: 18, display: "grid", gap: 4 } }, pendingGuard.map((r) => h("li", { key: `${r.stage}:${r.unit ?? ""}`, style: { color: T.fg, fontSize: 13 } }, `${r.unit ? `${r.unit} · ` : ""}${r.stage} — refused ${r.count}×; its recovery question waits for the next step.`)))) : null, h(Card, { title: "Needs you" }, m.blockers.length === 0 && !m.gates.awaitingStage ? h(Muted, null, "Nothing is waiting on a person right now.") : h("ul", { style: { margin: 0, paddingLeft: 18, display: "grid", gap: 6 } }, m.gates.awaitingStage ? h("li", { key: "gate", style: { fontSize: 13 } }, `Gate open on ${m.gates.awaitingStage}`) : null, m.blockers.map((b) => h("li", { key: `${b.rel}#${b.heading}`, style: { fontSize: 13 } }, `${b.unit ? `${b.unit} · ` : ""}${b.stage} · ${b.heading}`, b.waitingSec === undefined ? null : ` · waiting ${seconds(b.waitingSec)}`)))), h(Card, { title: "Warnings" }, m.warnings.length === 0 ? h(Muted, null, "This read hit no problems.") : h("ul", { style: { margin: 0, paddingLeft: 18, display: "grid", gap: 4 } }, m.warnings.map((w) => h("li", { key: w.code, style: { fontSize: 13, color: T.warning } }, w.code)))));
}
function Stages({ m }) {
  const runtime = m.runtime?.stages ?? [];
  return h("div", { style: { display: "grid", gap: 16 } }, m.state.phases.map((phase) => h(Card, { key: phase.key, title: `${phase.display} · ${phase.declaredStatus || "—"}` }, phase.stages.length === 0 ? h(Muted, null, "No stages recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 } }, phase.stages.map((stage) => {
    const runtimeStage = runtime.find((r) => r.slug === stage.slug);
    const key = stage.bolt ? `construction/${stage.bolt}/${stage.slug}` : `${phase.key}/${stage.slug}`;
    const files = m.artifacts?.[key] ?? [];
    return h("li", {
      key: `${stage.bolt ?? ""}:${stage.slug}`,
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "baseline",
        borderTop: `1px solid ${T.border}`,
        paddingTop: 8
      }
    }, h("span", { style: { fontWeight: 600, fontSize: 13 } }, stage.display || stage.slug), h(Status, { status: stage.status }), h("span", { style: { color: T.muted, fontSize: 12 } }, `${files.length} files`), runtimeStage?.elapsedSec !== undefined ? h("span", { style: { color: T.blue, fontSize: 12 } }, `engine ${seconds(runtimeStage.elapsedSec)}`) : null);
  })))));
}
function Timeline({ m }) {
  const stages = m.timing?.stages ?? [];
  return h(Card, { title: "Where the time went" }, stages.length === 0 ? h(Muted, null, "No stage spans in the ledger.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } }, stages.map((stage) => h("li", {
    key: stage.stage,
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      borderTop: `1px solid ${T.border}`,
      paddingTop: 6,
      fontSize: 13
    }
  }, h("span", null, stage.stage, h("span", { style: { color: T.muted } }, ` · ${stage.endKind}`)), h("span", { style: { fontVariantNumeric: "tabular-nums", fontWeight: 600 } }, seconds(stage.elapsedSec))))));
}
function Decisions({ m }) {
  const items = m.deferrals?.items ?? [];
  const questions = m.questions ?? {};
  return h("div", { style: { display: "grid", gap: 16 } }, h("div", { style: { ...cardStyle(), display: "flex", flexWrap: "wrap", gap: 24 } }, h(Figure, { label: "open items", value: items.length }), h(Figure, { label: "assumptions", value: (m.deferrals?.assumptions ?? []).length }), h(Figure, { label: "unanswered", value: questions.totalUnanswered ?? 0 }), h(Figure, { label: "questions", value: questions.totalQuestions ?? 0 })), h(Card, { title: "Deferred items" }, items.length === 0 ? h(Muted, null, "No deferred item recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 } }, items.slice(0, 25).map((item) => h("li", {
    key: `${item.rel}#${item.item}`,
    style: { borderTop: `1px solid ${T.border}`, paddingTop: 8 }
  }, h("div", { style: { fontWeight: 600, fontSize: 13 } }, item.item), h("div", { style: { color: T.muted, fontSize: 12 } }, `${item.unit ? `${item.unit} · ` : ""}${item.stage} → ${item.assignment}`))))));
}
function Sources({ m }) {
  const provenance = Object.values(m.provenance ?? {});
  const knowledge = m.knowledge;
  return h("div", { style: { display: "grid", gap: 16 } }, h(Card, { title: "Freshness of each input" }, h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } }, provenance.map((p) => h("li", {
    key: p.source,
    style: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }
  }, h("span", { style: { fontWeight: 600 } }, p.source), h("span", { style: { color: p.stale ? T.warning : T.success } }, p.stale ? "stale" : "fresh"))))), knowledge ? h(Card, { title: "Knowledge inputs" }, h(Muted, null, `${knowledge.documentFiles} documents`), knowledge.indexedDocuments !== undefined ? h(Muted, null, `${knowledge.indexedDocuments} indexed · ${knowledge.tombstones ?? 0} tombstones`) : h(Muted, null, "No catalog index"), knowledge.memoryFiles.length > 0 ? h(Muted, null, `rules: ${knowledge.memoryFiles.join(", ")}`) : null, knowledge.codekbRepos.length > 0 ? h(Muted, null, `code knowledge: ${knowledge.codekbRepos.join(", ")}`) : null) : null, h(Card, { title: "Reviewer passes" }, (m.reviews ?? []).length === 0 ? h(Muted, null, "No reviewer pass recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } }, (m.reviews ?? []).map((r) => h("li", { key: r.rel, style: { fontSize: 13 } }, `${r.unit ? `${r.unit} · ` : ""}${r.stage} #${r.number} · ${r.verdict ?? "—"}${r.findings ? ` · ${r.findings} findings` : ""}`)))), h(Card, { title: "Execution record" }, m.runtime ? h(Muted, null, `${m.runtime.stages.length} stages from runtime-graph`) : h(Muted, null, "runtime-graph.json is not present in this clone"), m.plan ? h(Muted, null, `plan: ${m.plan.filter((p) => p.action === "EXECUTE").length} execute · ${m.plan.filter((p) => p.action === "SKIP").length} skip`) : null, m.plugins ? h(Muted, null, `plugins: ${m.plugins.enabled.join(", ") || "—"}`) : null));
}
var BODY = {
  overview: Overview,
  stages: Stages,
  timeline: Timeline,
  decisions: Decisions,
  sources: Sources
};
function App({ model, tab = "overview", onTab = () => {} }) {
  if (!model)
    return h(Muted, null, "Reading the run…");
  const Page = BODY[tab] ?? Overview;
  return h("div", { style: { display: "grid", gap: 16, color: T.fg, fontFamily: "inherit" } }, h("nav", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, "aria-label": "Ledger sections" }, TABS.map(([id, label]) => h("button", {
    key: id,
    type: "button",
    onClick: () => onTab(id),
    "aria-pressed": tab === id,
    style: {
      border: `1px solid ${tab === id ? T.primary : T.border}`,
      background: tab === id ? T.primary : "transparent",
      color: tab === id ? T.primaryFg : T.fg,
      borderRadius: 999,
      padding: "4px 12px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, label))), h(Page, { m: model }), h(Muted, null, "Read-only: this page never writes to the workspace."));
}
function mount(element) {
  const root = createRoot(element);
  function Shell() {
    const [state, setState] = useState({ status: "loading" });
    const [tab, setTab] = useState("overview");
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
      return h(Muted, null, "Reading the run…");
    if (state.status === "unreachable")
      return h(Muted, null, "The Ledger backend did not answer.");
    if (state.status === "refused")
      return h(Muted, null, state.code === "no-workspace" ? "No workspace is selected yet. Pick an AI-DLC v2 workspace to read." : state.code === "not-a-workspace" ? "That path is not an AI-DLC v2 workspace." : "The run could not be read.");
    return h(App, { model: state.model, tab, onTab: setTab });
  }
  root.render(h(Shell));
  return () => root.unmount();
}
export {
  App,
  mount
};
