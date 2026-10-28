// apps/kirocrew/ui/src/index.js
import lucideDefault, * as lucideNamed from "lucide-react";
import { createElement as h, useEffect, useState } from "react";
function icon(wanted, fallback) {
  return lucideDefault?.[wanted] ?? lucideNamed[wanted] ?? lucideNamed[fallback] ?? lucideDefault?.[fallback] ?? lucideNamed.AlertTriangle;
}
var CircleCheck = icon("CircleCheck", "Check");
var CircleAlert = icon("CircleAlert", "AlertTriangle");
var CircleX = icon("CircleX", "X");
var Clock = icon("Clock", "Clock");
var BASE = "/apps/aidlc-management-tool/api/apps/aidlc-management-tool";
var T = {
  fg: "var(--text, #000000)",
  muted: "var(--muted, #4b5563)",
  border: "var(--border, #e5e7eb)",
  card: "var(--card, #ffffff)",
  primary: "var(--primary, #ffc708)",
  primaryFg: "#000000",
  success: "var(--success, #16a34a)",
  warning: "var(--warning, #f59e0b)",
  danger: "var(--destructive, #ef4444)"
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
  done: [CircleCheck, "done", T.success],
  active: [Clock, "active", T.warning],
  awaiting: [CircleAlert, "awaiting approval", T.warning],
  revising: [CircleAlert, "revising", T.warning],
  skipped: [CircleX, "skipped", T.muted],
  pending: [CircleAlert, "pending", T.muted]
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
  const [open, setOpen] = useState(null);
  return h("div", { style: { display: "grid", gap: 16 } }, m.state.phases.map((phase) => h(Card, { key: phase.key, title: `${phase.display} · ${phase.declaredStatus || "—"}` }, phase.stages.length === 0 ? h(Muted, null, "No stages recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 } }, phase.stages.map((stage) => {
    const runtimeStage = runtime.find((r) => r.slug === stage.slug);
    const key = stage.bolt ? `construction/${stage.bolt}/${stage.slug}` : `${phase.key}/${stage.slug}`;
    const files = m.artifacts?.[key] ?? [];
    const id = `${phase.key}:${stage.bolt ?? ""}:${stage.slug}`;
    const reviews = (m.reviews ?? []).filter((r) => r.stage === stage.slug && (r.unit ?? undefined) === (stage.bolt ?? undefined));
    const sensorFailures = (m.sensors?.failures ?? []).filter((f) => f.stage === stage.slug);
    return h("li", { key: id, style: { borderTop: `1px solid ${T.border}`, paddingTop: 8 } }, h("button", {
      type: "button",
      onClick: () => setOpen(open === id ? null : id),
      "aria-expanded": open === id,
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "baseline",
        width: "100%",
        border: "none",
        background: "none",
        padding: 0,
        color: T.fg,
        font: "inherit",
        textAlign: "left",
        cursor: "pointer"
      }
    }, h("span", { style: { fontWeight: 600, fontSize: 13 } }, stage.display || stage.slug), h(Status, { status: stage.status }), h("span", { style: { color: T.muted, fontSize: 12 } }, `${files.length} files`), reviews.length > 0 ? h("span", { style: { color: T.muted, fontSize: 12 } }, `${reviews.length} reviews`) : null, runtimeStage?.elapsedSec !== undefined ? h("span", { style: { color: T.fg, fontSize: 12 } }, `engine ${seconds(runtimeStage.elapsedSec)}`) : null), open === id ? h("div", {
      style: {
        marginTop: 8,
        paddingLeft: 12,
        borderLeft: `2px solid ${T.border}`,
        display: "grid",
        gap: 6,
        fontSize: 12,
        color: T.fg
      }
    }, h("div", null, h("span", { style: { fontWeight: 600 } }, "artifacts"), ` ${files.length}`, files.length > 0 ? `: ${files.map((f) => f.rel.split("/").pop()).join(", ")}` : ""), reviews.length > 0 ? h("div", null, h("span", { style: { fontWeight: 600 } }, "reviews"), ` ${reviews.map((r) => `#${r.number} ${r.verdict ?? "—"}${r.findings ? ` (${r.findings})` : ""}`).join(", ")}`) : h("div", { style: { color: T.muted } }, "no reviewer pass recorded"), sensorFailures.length > 0 ? h("div", { style: { color: T.warning } }, h("span", { style: { fontWeight: 600 } }, "sensor failures"), ` ${sensorFailures.length}`) : h("div", { style: { color: T.muted } }, "no sensor failure recorded")) : null);
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
function AnswerPanel({ m }) {
  const [choice, setChoice] = useState("approve");
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState("");
  const [problems, setProblems] = useState([]);
  const [mapping, setMapping] = useState({ status: "loading" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const stage = m.gates.awaitingStage;
  useEffect(() => {
    let live = true;
    fetch("/api/chat/slots", { cache: "no-store", credentials: "include" }).then(async (res) => {
      const slots = res.ok ? await res.json() : [];
      if (!live)
        return;
      const root = (m.identity?.root ?? "").replace(/\/+$/, "");
      const match = Array.isArray(slots) ? slots.find((slot) => (slot.project ?? "").replace(/\/+$/, "") === root) ?? slots.find((slot) => (slot.project ?? "").startsWith(`${root}/`)) ?? null : null;
      setMapping({ status: "ready", slot: match });
    }).catch(() => live && setMapping({ status: "unavailable" }));
    return () => {
      live = false;
    };
  }, [m.identity?.root]);
  useEffect(() => {
    if (!stage)
      return;
    const timer = setTimeout(() => {
      const draft = {
        stage,
        choice,
        ...choice === "request-changes" ? { feedback } : {}
      };
      fetch(`${BASE}/decisions/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft })
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        setPreview(body.text ?? "");
        setProblems(body.problems ?? []);
      }).catch(() => setPreview(""));
    }, 250);
    return () => clearTimeout(timer);
  }, [stage, choice, feedback]);
  if (!stage)
    return null;
  const slot = mapping.slot;
  const blocked = mapping.status === "loading" ? "Looking for this workspace's session…" : null;
  const canSend = Boolean(slot) && preview.length > 0 && problems.length === 0 && !busy;
  function send() {
    setBusy(true);
    setResult(null);
    fetch(`${BASE}/decisions/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sendId: crypto.randomUUID(),
        draft: {
          stage,
          choice,
          ...choice === "request-changes" ? { feedback } : {}
        }
      })
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      setResult({
        status: res.ok ? "delivered" : body.error?.code ?? "refused",
        record: body.record
      });
    }).catch(() => setResult({ status: "unreachable" })).finally(() => setBusy(false));
  }
  return h(Card, { title: `Answer the open gate · ${stage}` }, h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, ["approve", "request-changes"].map((value) => h("button", {
    key: value,
    type: "button",
    onClick: () => setChoice(value),
    "aria-pressed": choice === value,
    style: {
      border: `1px solid ${choice === value ? T.primary : T.border}`,
      background: choice === value ? T.primary : "transparent",
      color: choice === value ? T.primaryFg : T.fg,
      borderRadius: 999,
      padding: "4px 12px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, value === "approve" ? "Approve" : "Request changes"))), choice === "request-changes" ? h("textarea", {
    value: feedback,
    onChange: (event) => setFeedback(event.target.value),
    placeholder: "What should change? Your words are sent as written.",
    rows: 3,
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: 8,
      borderRadius: 4,
      border: `1px solid ${T.border}`,
      background: T.card,
      color: T.fg,
      font: "inherit"
    }
  }) : null, h(Muted, null, "This exact text will be sent:"), h("pre", {
    style: {
      margin: 0,
      padding: 8,
      borderRadius: 4,
      border: `1px solid ${T.border}`,
      background: T.card,
      color: T.fg,
      fontSize: 13,
      whiteSpace: "pre-wrap"
    }
  }, preview || "…"), problems.length > 0 ? h("p", { style: { margin: 0, color: T.warning, fontSize: 13 } }, problems.join(", ")) : null, h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, h("button", {
    type: "button",
    onClick: send,
    disabled: !canSend,
    style: {
      padding: "6px 14px",
      borderRadius: 4,
      border: "none",
      background: T.primary,
      color: T.primaryFg,
      fontWeight: 600,
      cursor: canSend ? "pointer" : "not-allowed",
      opacity: canSend ? 1 : 0.6
    }
  }, busy ? "Sending…" : "Send to the intent session"), h(Muted, null, blocked ?? (slot ? `Session: ${slot.title ?? slot.key}` : "No Kiro Crew session is bound to this workspace, so nothing is sent."))), result ? h(Muted, null, result.status === "delivered" ? "Delivered. AI-DLC records it as a human turn; this page does not mark it resolved." : `Not delivered: ${result.status}`) : null);
}
function Decisions({ m }) {
  const items = m.deferrals?.items ?? [];
  const questions = m.questions ?? {};
  return h("div", { style: { display: "grid", gap: 16 } }, h("div", { style: { ...cardStyle(), display: "flex", flexWrap: "wrap", gap: 24 } }, h(Figure, { label: "open items", value: items.length }), h(Figure, { label: "assumptions", value: (m.deferrals?.assumptions ?? []).length }), h(Figure, { label: "unanswered", value: questions.totalUnanswered ?? 0 }), h(Figure, { label: "questions", value: questions.totalQuestions ?? 0 })), h(AnswerPanel, { m }), h(Card, { title: "Deferred items" }, items.length === 0 ? h(Muted, null, "No deferred item recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 } }, items.slice(0, 25).map((item) => h("li", {
    key: `${item.rel}#${item.item}`,
    style: { borderTop: `1px solid ${T.border}`, paddingTop: 8 }
  }, h("div", { style: { fontWeight: 600, fontSize: 13 } }, item.item), h("div", { style: { color: T.muted, fontSize: 12 } }, `${item.unit ? `${item.unit} · ` : ""}${item.stage} → ${item.assignment}`))))));
}
function Sources({ m }) {
  const [opened, setOpened] = useState(null);
  const provenance = Object.values(m.provenance ?? {});
  const knowledge = m.knowledge;
  function open(rel) {
    setOpened({ rel, status: "loading" });
    fetch(`${BASE}/view?rel=${encodeURIComponent(rel)}`, { cache: "no-store" }).then(async (res) => {
      const body = await res.json();
      setOpened(body?.ok ? { rel, text: body.source?.text ?? "" } : { rel, error: body?.refusal?.code ?? body?.error?.code ?? "refused" });
    }).catch(() => setOpened({ rel, error: "unreachable" }));
  }
  return h("div", { style: { display: "grid", gap: 16 } }, h(Card, { title: "Freshness of each input" }, h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } }, provenance.map((p) => h("li", {
    key: p.source,
    style: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }
  }, h("span", { style: { fontWeight: 600 } }, p.source), h("span", { style: { color: p.stale ? T.warning : T.success } }, p.stale ? "stale" : "fresh"))))), knowledge ? h(Card, { title: "Knowledge inputs" }, h(Muted, null, `${knowledge.documentFiles} documents`), knowledge.indexedDocuments !== undefined ? h(Muted, null, `${knowledge.indexedDocuments} indexed · ${knowledge.tombstones ?? 0} tombstones`) : h(Muted, null, "No catalog index"), knowledge.memoryFiles.length > 0 ? h(Muted, null, `rules: ${knowledge.memoryFiles.join(", ")}`) : null, knowledge.codekbRepos.length > 0 ? h(Muted, null, `code knowledge: ${knowledge.codekbRepos.join(", ")}`) : null) : null, h(Card, { title: "Reviewer passes" }, (m.reviews ?? []).length === 0 ? h(Muted, null, "No reviewer pass recorded.") : h("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 } }, (m.reviews ?? []).map((r) => h("li", { key: r.rel, style: { fontSize: 13 } }, `${r.unit ? `${r.unit} · ` : ""}${r.stage} #${r.number} · ${r.verdict ?? "—"}${r.findings ? ` · ${r.findings} findings` : ""} · `, h("button", {
    type: "button",
    onClick: () => open(r.rel),
    style: {
      border: "none",
      background: "none",
      padding: 0,
      color: T.fg,
      font: "inherit",
      textDecoration: "underline",
      textUnderlineOffset: 4,
      cursor: "pointer"
    }
  }, r.rel.split("/").pop() ?? r.rel))))), opened ? h(Card, { title: opened.rel }, opened.status === "loading" ? h(Muted, null, "Reading…") : opened.error ? h(Muted, null, `Refused: ${opened.error}`) : h("pre", {
    style: {
      margin: 0,
      maxHeight: 420,
      overflow: "auto",
      fontSize: 12,
      lineHeight: "18px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }
  }, opened.text)) : null, h(Card, { title: "Execution record" }, m.runtime ? h(Muted, null, `${m.runtime.stages.length} stages from runtime-graph`) : h(Muted, null, "runtime-graph.json is not present in this clone"), m.plan ? h(Muted, null, `plan: ${m.plan.filter((p) => p.action === "EXECUTE").length} execute · ${m.plan.filter((p) => p.action === "SKIP").length} skip`) : null, m.plugins ? h(Muted, null, `plugins: ${m.plugins.enabled.join(", ") || "—"}`) : null));
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
  return h("div", {
    style: {
      display: "grid",
      gap: 16,
      color: T.fg,
      fontFamily: "inherit",
      padding: "52px 8px 16px",
      maxWidth: 1100
    }
  }, h("nav", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, "aria-label": "Ledger sections" }, TABS.map(([id, label]) => h("button", {
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
function WorkspacePicker({ onAdded = () => window.location.reload() }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    fetch(`${BASE}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ root: value })
    }).then(async (res) => {
      if (res.ok) {
        onAdded();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.code ?? "refused");
    }).catch(() => setError("unreachable")).finally(() => setBusy(false));
  }
  return h("div", { style: { display: "grid", gap: 12, padding: "52px 8px 16px", maxWidth: 720 } }, h("h1", { style: { margin: 0, fontSize: 22, fontWeight: 600, color: T.fg } }, "Choose an AI-DLC v2 workspace"), h(Muted, null, "The app reads this folder and never writes to it. The choice is kept for this app only."), h("form", { onSubmit: save, style: { display: "flex", gap: 8, flexWrap: "wrap" } }, h("input", {
    value,
    onChange: (event) => setValue(event.target.value),
    placeholder: "/home/you/work/project",
    "aria-label": "Workspace path",
    style: {
      flex: "1 1 320px",
      minWidth: 240,
      padding: "8px 10px",
      borderRadius: 4,
      border: `1px solid ${T.border}`,
      background: T.card,
      color: T.fg,
      font: "inherit"
    }
  }), h("button", {
    type: "submit",
    disabled: busy,
    style: {
      padding: "8px 14px",
      borderRadius: 4,
      border: "none",
      background: T.primary,
      color: T.primaryFg,
      fontWeight: 600,
      cursor: busy ? "wait" : "pointer"
    }
  }, busy ? "Checking…" : "Read this workspace")), error ? h("p", { style: { margin: 0, color: T.danger, fontSize: 13 } }, error === "not-a-workspace" ? "That folder has no aidlc/ tree." : error === "unreachable" ? "The Ledger backend did not answer." : "The workspace could not be set.") : null);
}
function LedgerPage() {
  const [projects, setProjects] = useState(null);
  const [selected, setSelected] = useState(() => typeof localStorage === "undefined" ? "" : localStorage.getItem("ledger-project") ?? "");
  const [mode, setMode] = useState("project");
  const [tab, setTab] = useState("overview");
  const [state, setState] = useState({ status: "loading" });
  function loadProjects() {
    return fetch(`${BASE}/projects`, { cache: "no-store" }).then(async (res) => res.ok ? (await res.json()).projects ?? [] : []).catch(() => []).then((rows) => {
      setProjects(rows);
      return rows;
    });
  }
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/projects`, { cache: "no-store" }).then(async (res) => res.ok ? (await res.json()).projects ?? [] : []).catch(() => []).then((rows) => {
      if (!live)
        return;
      setProjects(rows);
      if (rows.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const stored = localStorage.getItem("ledger-project") ?? "";
      setSelected(rows.some((p) => p.root === stored) ? stored : rows[0].root);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!selected)
      return;
    localStorage.setItem("ledger-project", selected);
    let live = true;
    setState((prev) => ({ ...prev, status: prev.model ? prev.status : "loading" }));
    fetch(`${BASE}/model?project=${encodeURIComponent(selected)}`, {
      cache: "no-store",
      headers: { accept: "application/json" }
    }).then(async (res) => {
      const body = await res.json();
      if (!live)
        return;
      setState(res.ok ? { status: "ready", model: body } : { status: "refused", code: body?.error?.code });
    }).catch(() => live && setState({ status: "unreachable" }));
    return () => {
      live = false;
    };
  }, [selected]);
  function openProject(root) {
    setSelected(root);
    setMode("project");
    setTab("overview");
  }
  if (projects === null)
    return h(Muted, null, "Reading projects…");
  if (projects.length === 0)
    return h(WorkspacePicker, { onAdded: loadProjects });
  const current = projects.find((p) => p.root === selected) ?? projects[0];
  const nav = h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 } }, h("select", {
    value: selected,
    onChange: (event) => openProject(event.target.value),
    "aria-label": "Project",
    style: {
      padding: "6px 8px",
      borderRadius: 4,
      border: `1px solid ${T.border}`,
      background: T.card,
      color: T.fg,
      font: "inherit"
    }
  }, projects.map((project) => h("option", { key: project.root, value: project.root }, project.name))), h("button", {
    type: "button",
    onClick: () => setMode("fleet"),
    "aria-pressed": mode === "fleet",
    style: chip(mode === "fleet")
  }, `Projects (${projects.length})`), h("button", {
    type: "button",
    onClick: () => setMode("queue"),
    "aria-pressed": mode === "queue",
    style: chip(mode === "queue")
  }, "Queue"), mode !== "project" ? h("button", { type: "button", onClick: () => setMode("project"), style: chip(false) }, "Back to the run") : null);
  if (mode === "fleet")
    return h("div", { "data-ledger-root": "", style: shellStyle() }, nav, h(Fleet, { onOpen: openProject }));
  if (mode === "queue")
    return h("div", { "data-ledger-root": "", style: shellStyle() }, nav, h(Queue, { onOpen: openProject }));
  if (state.status === "unreachable")
    return h(Muted, null, "The Ledger backend did not answer.");
  if (state.status === "refused")
    return h(Muted, null, state.code === "not-a-workspace" ? `${current.name} is no longer an AI-DLC v2 workspace.` : state.code === "no-project" ? "That project is not registered any more." : "The run could not be read.");
  if (state.status === "loading")
    return h(Muted, null, "Reading the run…");
  return h("div", { "data-ledger-root": "", style: shellStyle() }, nav, h(App, { model: state.model, tab, onTab: setTab }));
}
function shellStyle() {
  return {
    display: "grid",
    gap: 12,
    color: T.fg,
    fontFamily: "inherit",
    padding: "52px 8px 16px",
    maxWidth: 1100
  };
}
function chip(active) {
  return {
    border: `1px solid ${active ? T.primary : T.border}`,
    background: active ? T.primary : "transparent",
    color: active ? T.primaryFg : T.fg,
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };
}
export {
  App,
  LedgerPage as default
};
