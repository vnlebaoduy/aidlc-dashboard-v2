import type { NoticeKind } from "@/lib/notify/detect";
// Copy that exists only in v2: navigation, page titles and leads, header controls.
import type { Locale } from "@server/model/types";
import type { StageStatus } from "@server/scan/parser";

export interface ChromeStrings {
  viewerPage: {
    preview: string;
    raw: string;
    mode: string;
    files: string;
    filter: string;
    noMatch: string;
    noFiles: string;
    back: string;
    showFiles: string;
    mermaidDiagram: string;
    mermaidLoading: string;
    mermaidError: string;
    mermaidFit: string;
    mermaidZoomIn: string;
    mermaidZoomOut: string;
    mermaidActualSize: string;
  };
  notify: {
    bell: string;
    heading: string;
    empty: string;
    markAllRead: string;
    clear: string;
    settings: string;
    systemLabel: string;
    systemHint: string;
    systemEnable: string;
    systemDenied: string;
    systemInsecure: string;
    systemUnsupported: string;
    systemDismissedTitle: string;
    systemDismissed: string;
    systemTestTitle: string;
    systemTestBody: string;
    milestonesLabel: string;
    milestonesHint: string;
    flashLabel: string;
    flashHint: string;
    open: string;
    tierAction: string;
    tierMilestone: string;
    titles: Record<NoticeKind, string>;
    /** Body line; `subject`/`detail` are verbatim run text. */
    body: (kind: NoticeKind, subject: string, detail?: string) => string;
  };
  appName: string;
  nav: {
    group: string;
    overview: string;
    stages: string;
    timeline: string;
    decisions: string;
    usage: string;
    sources: string;
    workspaces: string;
  };
  lead: {
    overview: string;
    stages: string;
    timeline: string;
    decisions: string;
    usage: string;
    sources: string;
    workspaces: string;
    viewer: string;
  };
  theme: { label: string; light: string; dark: string; system: string };
  toggleSidebar: string;
  skipToContent: string;
  openFull: string;
  noData: string;
  retry: string;
  notFound: string;
  backHome: string;
  backToDashboard: string;
  usagePage: { trend: string; byModel: string; sessionTime: string };
  sourcesPage: {
    noWarnings: string;
    freshness: string;
    colSource: string;
    colStatus: string;
    colReason: string;
    fresh: string;
    identity: string;
    root: string;
    space: string;
    harness: string;
    record: string;
    stateFile: string;
    execution: string;
    /** `stages` and `workflowId` are already read; `workflowId` may be "—". */
    runtimeMeta: (stages: number, workflowId: string) => string;
    runtimeMissing: string;
    knowledge: string;
    knowledgeDocuments: string;
    knowledgeIndexed: string;
    knowledgeStates: string;
    knowledgeCodekb: string;
    knowledgeRules: string;
    phaseChecks: string;
    phaseCheckEmpty: string;
    plan: string;
    plugins: string;
    reviews: string;
    reviewFindings: (n: number) => string;
    planSummary: (execute: number, skip: number) => string;
    spaces: string;
    registry: string;
  };
  decisionsPage: {
    tabs: {
      passed: string;
      current: string;
      ahead: string;
      rest: string;
      assumptions: string;
      questions: string;
      owners: string;
    };
  };
  timelinePage: {
    breakdown: string;
    gantt: string;
    figures: string;
    classified: string;
    classifiedShare: string;
  };
  stagesPage: {
    navLabel: string;
    phases: string;
    units: string;
    matrix: string;
    status: Record<StageStatus, string>;
    stageCount: (done: number, total: number) => string;
    files: (n: number) => string;
    provisional: string;
    settings: {
      depth: string;
      testStrategy: string;
      guardPolicy: string;
      sensors: string;
      planApproval: string;
      collaborators: string;
    };
  };
  overviewPage: {
    needsYou: string;
    /** `wait` already formatted. */
    waiting: (wait: string) => string;
    readWarnings: (n: number) => string;
    guardRefusal: (stage: string, count: number) => string;
    outcomesTitle: string;
    outcomesLead: string;
    outcomesOpen: string;
    /** `size` and `when` already formatted. */
    outcomesMeta: (size: string, when: string) => string;
    outcomesFromWorkspace: string;
  };
}

const EN: ChromeStrings = {
  viewerPage: {
    preview: "Preview",
    raw: "Raw",
    mode: "View mode",
    files: "Record files",
    filter: "Filter files",
    noMatch: "No file matches.",
    noFiles: "No stage has produced files yet.",
    back: "Back",
    showFiles: "Files",
    mermaidDiagram: "Mermaid diagram",
    mermaidLoading: "Rendering diagram…",
    mermaidError: "Could not render this Mermaid diagram. Source is shown below.",
    mermaidFit: "Fit",
    mermaidZoomIn: "Zoom in",
    mermaidZoomOut: "Zoom out",
    mermaidActualSize: "Actual size (100%)",
  },
  notify: {
    bell: "Notifications",
    heading: "Notifications",
    empty: "Nothing yet. You will be told here when the run needs you or reaches a milestone.",
    markAllRead: "Mark all read",
    clear: "Clear",
    settings: "Settings",
    systemLabel: "System notifications",
    systemHint:
      "Alert outside this tab when the run needs you (gate, question, stuck, failed check, complete).",
    systemEnable: "Allow",
    systemDenied: "Blocked in browser settings. Allow notifications for this site to turn this on.",
    systemInsecure:
      "Needs https or localhost. Opened by IP over http, the browser offers no system notifications — in-app alerts still work.",
    systemUnsupported: "This browser has no notification support.",
    systemDismissedTitle: "The browser did not show a prompt",
    systemDismissed:
      "Chrome stops asking after a prompt was dismissed. Click the icon left of the address (tune / lock, or the bell at its right end) → Notifications → Allow, then come back to this tab.",
    systemTestTitle: "Notifications are on",
    systemTestBody:
      "You will get one like this when the run needs you and this tab is in the background.",
    milestonesLabel: "Milestone pop-ups",
    milestonesHint: "Also pop up when a stage, unit or phase completes or a gate is rejected.",
    flashLabel: "Flash the tab title",
    flashHint:
      "While you are on another tab, the title blinks when something new arrives. Stops when you come back.",
    open: "Open",
    tierAction: "Needs you",
    tierMilestone: "Milestone",
    titles: {
      gate: "Approval needed",
      ask: "Question waiting for you",
      stuck: "Run is stuck",
      "check-failed": "Check failed",
      "run-complete": "Run complete",
      "stage-completed": "Stage completed",
      "unit-completed": "Unit completed",
      "phase-completed": "Phase completed",
      "gate-rejected": "Gate rejected — rework",
      "workflow-parked": "Workflow parked",
    },
    body: (kind, subject, detail) =>
      kind === "ask"
        ? `${subject}: ${detail ?? ""}`
        : kind === "stuck"
          ? `${subject} — blocked ${detail ?? "?"}× in a row`
          : kind === "check-failed"
            ? `${subject} — ${detail ?? "?"} failure(s) recorded`
            : kind === "gate"
              ? `${subject} is waiting at its approval gate`
              : subject,
  },
  appName: "AI-DLC Dashboard",
  nav: {
    group: "Run",
    overview: "Overview",
    stages: "Stages & units",
    timeline: "Timeline",
    decisions: "Decisions",
    usage: "Usage",
    sources: "Sources",
    workspaces: "Workspaces",
  },
  lead: {
    overview: "Is the run moving, what needs you, and how far along it is.",
    stages: "Every phase and stage, the files each produced, and per-unit progress.",
    timeline: "Where the time went: work, chat, waiting, and what was done twice.",
    decisions: "Decisions the run deferred, who owns them, and open questions.",
    usage: "What the run cost, from the harness's own records.",
    sources: "How fresh each input is, and anything this read could not do.",
    workspaces: "Pick the AI-DLC workspace to read. Nothing is written to it.",
    viewer: "Read-only view of a record file.",
  },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
  toggleSidebar: "Toggle sidebar",
  skipToContent: "Skip to content",
  openFull: "Open full view",
  noData: "No data yet",
  retry: "Try again",
  notFound: "This page does not exist.",
  backHome: "Back to overview",
  backToDashboard: "Back to dashboard",
  usagePage: { trend: "Trend", byModel: "By model", sessionTime: "Session time" },
  sourcesPage: {
    noWarnings: "This read hit no problems.",
    freshness: "Freshness of each input",
    colSource: "source",
    colStatus: "status",
    colReason: "why",
    fresh: "fresh",
    identity: "What was read",
    root: "workspace root",
    space: "space",
    harness: "harness",
    record: "intent record",
    stateFile: "state file",
    execution: "Execution record",
    runtimeMeta: (stages, workflowId) =>
      `${stages} stages from runtime-graph · workflow ${workflowId}`,
    runtimeMissing:
      "runtime-graph.json is not present in this clone — stage spans come from the audit only",
    knowledge: "Knowledge inputs",
    knowledgeDocuments: "documents",
    knowledgeIndexed: "indexed",
    knowledgeStates: "catalog states",
    knowledgeCodekb: "code knowledge",
    knowledgeRules: "rule files",
    phaseChecks: "Phase checks",
    phaseCheckEmpty: "No phase has closed yet.",
    plan: "resolved plan",
    plugins: "plugins",
    reviews: "Reviewer passes",
    reviewFindings: (n) => (n === 1 ? "1 finding" : `${n} findings`),
    planSummary: (execute, skip) => `${execute} execute · ${skip} skip`,
    spaces: "spaces",
    registry: "intent registry",
  },
  decisionsPage: {
    tabs: {
      passed: "Past stage",
      current: "Current stage",
      ahead: "Later stage",
      rest: "Unassigned & exits",
      assumptions: "Assumptions",
      questions: "Open questions",
      owners: "By owner",
    },
  },
  timelinePage: {
    breakdown: "Where the time went",
    gantt: "Stage by stage",
    figures: "Minutes per stage",
    classified: "classified span",
    classifiedShare: "of the window is classified",
  },
  stagesPage: {
    navLabel: "On this page",
    phases: "Phases",
    units: "Units",
    matrix: "Matrix",
    status: {
      done: "done",
      active: "active",
      awaiting: "awaiting approval",
      revising: "revising",
      skipped: "skipped",
      pending: "pending",
    },
    stageCount: (done, total) => `${done}/${total} stages`,
    files: (n) => (n === 1 ? "1 file" : `${n} files`),
    settings: {
      depth: "depth",
      testStrategy: "test strategy",
      guardPolicy: "guard policy",
      sensors: "sensors",
      planApproval: "plan approval",
      collaborators: "collaborators",
    },
    provisional: "in flight",
  },
  overviewPage: {
    needsYou: "Needs you",
    waiting: (wait) => `waiting ${wait}`,
    readWarnings: (n) =>
      n === 1 ? "See the warning on Sources" : `See all ${n} warnings on Sources`,
    guardRefusal: (stage, count) =>
      `A guard is holding ${stage} (refused ${count}×) and left its recovery question for the next step.`,
    outcomesTitle: "Outcomes pack",
    outcomesLead: "Handover summary of this run: what was built, setup, decisions, next steps.",
    outcomesOpen: "Open OUTCOMES.md",
    outcomesMeta: (size, when) => `${size} · updated ${when}`,
    outcomesFromWorkspace:
      "Read from the workspace root, not this run's record. The next run overwrites it, so it may belong to another intent; keep a copy in the record.",
  },
};

const VI: ChromeStrings = {
  viewerPage: {
    preview: "Xem trước",
    raw: "Mã nguồn",
    mode: "Chế độ xem",
    files: "File của run",
    filter: "Lọc file",
    noMatch: "Không có file nào khớp.",
    noFiles: "Chưa stage nào tạo ra file.",
    back: "Quay lại",
    showFiles: "Danh sách file",
    mermaidDiagram: "Sơ đồ Mermaid",
    mermaidLoading: "Đang vẽ sơ đồ…",
    mermaidError: "Không thể vẽ sơ đồ Mermaid này. Mã nguồn được hiển thị bên dưới.",
    mermaidFit: "Vừa khung",
    mermaidZoomIn: "Phóng to",
    mermaidZoomOut: "Thu nhỏ",
    mermaidActualSize: "Kích thước gốc (100%)",
  },
  notify: {
    bell: "Thông báo",
    heading: "Thông báo",
    empty: "Chưa có gì. Khi run cần bạn hoặc đạt một mốc, thông báo sẽ hiện ở đây.",
    markAllRead: "Đánh dấu đã đọc",
    clear: "Xoá",
    settings: "Cài đặt",
    systemLabel: "Thông báo hệ thống",
    systemHint:
      "Báo cả khi bạn không mở tab này, lúc run cần bạn (gate, câu hỏi, bị kẹt, check lỗi, hoàn tất).",
    systemEnable: "Cho phép",
    systemDenied:
      "Đang bị chặn trong cài đặt trình duyệt. Cho phép thông báo cho trang này để bật.",
    systemInsecure:
      "Cần https hoặc localhost. Mở bằng IP qua http thì trình duyệt không cho thông báo hệ thống — thông báo trong app vẫn hoạt động.",
    systemUnsupported: "Trình duyệt này không hỗ trợ thông báo.",
    systemDismissedTitle: "Trình duyệt không hiện hộp hỏi quyền",
    systemDismissed:
      "Chrome ngừng hỏi sau khi hộp hỏi bị tắt vài lần. Bấm biểu tượng bên trái thanh địa chỉ (tune / ổ khoá, hoặc chuông ở cuối thanh) → Thông báo → Cho phép, rồi quay lại tab này.",
    systemTestTitle: "Đã bật thông báo",
    systemTestBody: "Bạn sẽ nhận thông báo như thế này khi run cần bạn và tab đang ở chế độ nền.",
    milestonesLabel: "Pop-up cho các mốc",
    milestonesHint: "Hiện cả khi stage, unit, phase hoàn thành hoặc gate bị từ chối.",
    flashLabel: "Nhấp nháy tiêu đề tab",
    flashHint:
      "Khi bạn đang ở tab khác, tiêu đề sẽ nhấp nháy lúc có sự kiện mới. Dừng khi bạn quay lại.",
    open: "Mở",
    tierAction: "Cần bạn",
    tierMilestone: "Mốc",
    titles: {
      gate: "Cần duyệt",
      ask: "Có câu hỏi chờ bạn",
      stuck: "Run đang bị kẹt",
      "check-failed": "Check thất bại",
      "run-complete": "Run đã hoàn tất",
      "stage-completed": "Stage hoàn thành",
      "unit-completed": "Unit hoàn thành",
      "phase-completed": "Phase hoàn thành",
      "gate-rejected": "Gate bị từ chối — làm lại",
      "workflow-parked": "Workflow tạm dừng",
    },
    body: (kind, subject, detail) =>
      kind === "ask"
        ? `${subject}: ${detail ?? ""}`
        : kind === "stuck"
          ? `${subject} — bị chặn ${detail ?? "?"} lần liên tiếp`
          : kind === "check-failed"
            ? `${subject} — ghi nhận ${detail ?? "?"} lỗi`
            : kind === "gate"
              ? `${subject} đang chờ duyệt ở gate`
              : subject,
  },
  appName: "AI-DLC Dashboard",
  nav: {
    group: "Run",
    overview: "Tổng quan",
    stages: "Stage & unit",
    timeline: "Dòng thời gian",
    decisions: "Quyết định",
    usage: "Chi phí sử dụng",
    sources: "Nguồn dữ liệu",
    workspaces: "Workspace",
  },
  lead: {
    overview: "Run có đang chạy không, cái gì đang chờ bạn, và đã đi được bao xa.",
    stages: "Mọi phase và stage, file mỗi stage tạo ra, và tiến độ từng unit.",
    timeline: "Thời gian đi đâu: làm việc, trao đổi, chờ đợi, và những gì phải làm lại.",
    decisions: "Các quyết định bị hoãn, ai chịu trách nhiệm, và câu hỏi còn mở.",
    usage: "Run đã tốn bao nhiêu, theo chính số liệu của harness.",
    sources: "Mỗi nguồn dữ liệu mới đến đâu, và những gì lần đọc này không làm được.",
    workspaces: "Chọn workspace AI-DLC để đọc. Không ghi gì vào workspace.",
    viewer: "Xem file bản ghi (chỉ đọc).",
  },
  theme: { label: "Giao diện", light: "Sáng", dark: "Tối", system: "Theo hệ thống" },
  toggleSidebar: "Ẩn/hiện thanh bên",
  skipToContent: "Chuyển tới nội dung",
  openFull: "Xem đầy đủ",
  noData: "Chưa có dữ liệu",
  retry: "Thử lại",
  notFound: "Trang này không tồn tại.",
  backHome: "Về tổng quan",
  backToDashboard: "Về dashboard",
  usagePage: { trend: "Xu hướng", byModel: "Theo model", sessionTime: "Thời gian phiên" },
  sourcesPage: {
    noWarnings: "Lần đọc này không gặp vấn đề nào.",
    freshness: "Độ mới của từng nguồn",
    colSource: "nguồn",
    colStatus: "trạng thái",
    colReason: "lý do",
    fresh: "mới",
    identity: "Đã đọc những gì",
    root: "thư mục workspace",
    space: "space",
    harness: "harness",
    record: "intent record",
    stateFile: "file trạng thái",
    execution: "Bản ghi thực thi",
    runtimeMeta: (stages, workflowId) =>
      `${stages} stage từ runtime-graph · workflow ${workflowId}`,
    runtimeMissing:
      "Không có runtime-graph.json trong bản clone này — khoảng thời gian stage chỉ đến từ audit",
    knowledge: "Đầu vào knowledge",
    knowledgeDocuments: "tài liệu",
    knowledgeIndexed: "đã index",
    knowledgeStates: "trạng thái catalog",
    knowledgeCodekb: "code knowledge",
    knowledgeRules: "file rule",
    phaseChecks: "Kiểm tra phase",
    phaseCheckEmpty: "Chưa phase nào đóng.",
    plan: "plan đã chốt",
    plugins: "plugin",
    reviews: "Lượt review",
    reviewFindings: (n) => `${n} finding`,
    planSummary: (execute, skip) => `${execute} thực thi · ${skip} bỏ`,
    spaces: "space",
    registry: "intent registry",
  },
  decisionsPage: {
    tabs: {
      passed: "Stage đã qua",
      current: "Stage hiện tại",
      ahead: "Stage sau",
      rest: "Chưa giao & ngoài chu kỳ",
      assumptions: "Giả định",
      questions: "Câu hỏi còn mở",
      owners: "Theo stage được giao",
    },
  },
  timelinePage: {
    breakdown: "Thời gian đã đi đâu",
    gantt: "Theo từng stage",
    figures: "Số phút theo stage",
    classified: "khoảng đã phân loại",
    classifiedShare: "của cửa sổ đã được phân loại",
  },
  stagesPage: {
    navLabel: "Trên trang này",
    phases: "Phase",
    units: "Unit",
    matrix: "Ma trận",
    status: {
      done: "xong",
      active: "đang chạy",
      awaiting: "chờ duyệt",
      revising: "đang sửa",
      skipped: "bỏ qua",
      pending: "chưa bắt đầu",
    },
    stageCount: (done, total) => `${done}/${total} stage`,
    files: (n) => `${n} file`,
    settings: {
      depth: "độ sâu",
      testStrategy: "chiến lược test",
      guardPolicy: "chính sách guard",
      sensors: "sensors",
      planApproval: "duyệt plan",
      collaborators: "cộng sự",
    },
    provisional: "đang chạy",
  },
  overviewPage: {
    needsYou: "Đang chờ bạn",
    waiting: (wait) => `đã chờ ${wait}`,
    readWarnings: (n) => `Xem ${n} cảnh báo ở trang Nguồn dữ liệu`,
    guardRefusal: (stage, count) =>
      `Guard đang giữ ${stage} (bị từ chối ${count} lần) và để lại câu hỏi khôi phục cho bước tiếp theo.`,
    outcomesTitle: "Outcomes pack",
    outcomesLead:
      "Tài liệu tổng kết sau khi chạy: đã làm gì, cách cài đặt, quyết định, việc tiếp theo.",
    outcomesOpen: "Mở OUTCOMES.md",
    outcomesMeta: (size, when) => `${size} · cập nhật ${when}`,
    outcomesFromWorkspace:
      "Đọc từ thư mục gốc workspace, không phải record của run này. Run sau sẽ ghi đè nên có thể là của intent khác; hãy lưu một bản vào record.",
  },
};

export const CHROME: Record<Locale, ChromeStrings> = { en: EN, vi: VI };
