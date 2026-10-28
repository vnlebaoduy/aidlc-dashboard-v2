// Vietnamese copy.
//
// Translated from the English catalogue (i18n-en.ts), which is itself the lingua-franca
// rendering of the measured Korean reasoning. The same two rules apply here:
//
//   - Translate the CLAIM, not the sentence shape.
//   - Engine vocabulary stays as the engine writes it. `stage`, `unit`, `clone`,
//     `UNIT_COMPLETED`, `Run floor`, `state.md`, `stage-graph.json`, audit event names,
//     file names and CLI flags are identifiers a reader will grep for, so they are never
//     localised. Vietnamese has no grammatical plural, so no plural helper is needed.

import type { ReceiptReason } from "@server/scan/matrix";
import type {
  BlockerStrings,
  CardStrings,
  CliStrings,
  DeferralStrings,
  ErrorPageStrings,
  ExplorerStrings,
  FreshnessStrings,
  HealthStrings,
  KpiStrings,
  OpenFileStrings,
  OverviewStrings,
  PageStrings,
  PickerStrings,
  StatusStrings,
  Strings,
  TimelineStrings,
  UsageStrings,
  ViewerStrings,
  WarnStrings,
} from "./catalog";
/**
 * What each `unverified` cause means. Split per cause because only ONE of them has a known
 * engine verdict: a row with no `Run floor` fails the engine's exact-match test, so the
 * engine WILL re-run that unit.
 */
const RECEIPT_REASON_VI: Record<ReceiptReason, string> = {
  "no-run-floor":
    "Đủ mọi artifact, nhưng biên nhận hoàn thành không có `Run floor` — engine coi unit này là chưa được phủ và sẽ chạy lại. Chỉ dựa vào audit ledger thì không biết công việc thực sự đã xong hay chưa (ledger được ghi trước khi có trường này)",
  "team-claim":
    "Đủ mọi artifact, và biên nhận hoàn thành được xác lập bởi claim file (team ownership) — chỉ dựa vào audit ledger thì không biết engine có coi là xong hay không. Bảng Unit Progress ở trên là nguồn có thẩm quyền",
  "wave-fingerprint":
    "Đủ mọi artifact, và biên nhận hoàn thành được xác lập bởi fingerprint của artifact (wave mode) — chỉ dựa vào audit ledger thì không biết engine có coi là xong hay không",
  "ambiguous-floor":
    "Đủ mọi artifact, nhưng các sự kiện ranh giới từ những clone khác nhau trùng timestamp, nên không tái tạo được attempt floor — chỉ dựa vào audit ledger thì không biết engine có coi là xong hay không",
};

const warn: WarnStrings = {
  catalogReadFailed: (harnessDir) =>
    `Không đọc được ${harnessDir}/tools/data/stage-graph.json — phán định artifact-contract và việc gán stage chuyển sang ước lượng gần đúng`,

  catalogNotFound:
    "Không tìm thấy stage catalogue (đã tìm <root>/<harness>/tools/data/stage-graph.json trong .kiro, .claude, .aidlc và mọi dot-dir khác) — " +
    "phán định artifact-contract và việc gán stage chuyển sang ước lượng gần đúng. Nếu cây harness nằm ở nơi khác, hãy trỏ --harness tới đó",

  auditEmpty: "Audit ledger trống — có thể các hook chưa từng chạy",
  pluginStagesDisabled: (count) =>
    `${count} stage thuộc plugin đang tắt nên không nằm trong lần chạy này`,
  runtimeStateDivergence: (stage) =>
    `runtime-graph ghi ${stage} đã hoàn thành, nhưng state.md chưa hiện điều đó — một trong hai đang trễ; trang này không tự chọn bên nào`,

  stateVersionMismatch: (stateVersion, harnessVersion, harnessDir) =>
    `state.md khai báo State Version ${stateVersion}, nhưng harness hỗ trợ ${harnessVersion} (${harnessDir}/tools/aidlc-lib.ts) — engine từ chối next, report và doctor với tổ hợp này. Không thể phán định contract theo một thế hệ khác, nên các phán định đã được bỏ qua`,

  stateVersionUnreadable: (stateVersion) =>
    `Không đọc được State Version từ state.md (${stateVersion === undefined ? "không có trường" : `giá trị: ${stateVersion}`}) — engine từ chối như nhau giá trị thiếu, rỗng hoặc không phải số (aidlc-lib.ts classifyStateVersion). Artifact contract vẫn được hiển thị, nhưng trang này không khẳng định các phán định hoàn thành khớp với engine`,

  teamWithoutUnitMajor: (constructionIteration) =>
    `Unit Ownership là team nhưng Construction Iteration không phải unit-major (${constructionIteration ?? "không có"}) — contract của engine yêu cầu cả hai đi cùng nhau, và chỉ khi đó mới có bảng Unit Progress. Hãy kiểm tra cấu hình`,

  unitProgressMalformed:
    "Bảng `## Unit Progress` trong state.md không đúng dạng engine định nghĩa (bảng không bắt đầu ở cột 0, hoặc cột đầu không phải `unit`, hoặc độ rộng hàng phân cách khác hàng tiêu đề — engine từ chối với cùng điều kiện). Không hiển thị owner và gate theo từng unit",

  unitProgressMissing:
    "Đây là run team / unit-major, nhưng state.md không có mục `## Unit Progress` — không có nguồn có thẩm quyền cho owner và gate theo từng unit, nên ma trận bên dưới được dựng lại từ đĩa và audit ledger",

  rosterMismatch: (stateVersion, unknownToCatalog, missingFromState) => {
    const ver = stateVersion ? `(State Version: ${stateVersion})` : "(không có State Version)";
    const engineNote = "engine cũng từ chối tổ hợp này: aidlc-lib.ts classifyStateVersion";
    const unknown =
      unknownToCatalog.length > 0
        ? ` · stage mà catalogue không biết: ${unknownToCatalog.join(", ")}`
        : "";
    const missing =
      missingFromState.length > 0
        ? ` · stage không có hàng trong state: ${missingFromState.join(", ")} (engine vẫn ghi hàng kể cả khi SKIP)`
        : "";
    return `Danh sách stage trong state.md và stage catalogue không khớp ${ver}${unknown}${missing}. Không thể tin phán định artifact-contract, nên chúng được tính gần đúng (${engineNote})`;
  },

  harnessCoexist: (harnesses, chosen) =>
    `Cùng tồn tại các thư mục harness ${harnesses.join(" và ")} và audit không xác định được công cụ nào đã chạy record này (không session nào khớp kho session của công cụ nào trên máy này) — đang đọc theo ${chosen === "claude" ? ".claude / token Claude Code" : ".kiro / credit Kiro"} theo thứ tự thư mục. Để cố định, truyền --harness ${chosen === "claude" ? ".kiro" : ".claude"}.`,

  tokenUsageFailed: (detail) =>
    `Tổng hợp token usage thất bại — chỉ bảng mức dùng bị ảnh hưởng: ${detail}`,

  creditAssemblyFailed: (detail) =>
    `Tổng hợp credit thất bại — chỉ bảng credit bị ảnh hưởng: ${detail}`,
};

const blockers: BlockerStrings = {
  staleStage: "stage trước (câu hỏi còn treo)",
  confirmation: "xác nhận gate",
  confirmationTip:
    "Không phải câu hỏi mà là xác nhận approval gate — run chỉ tiếp tục khi bạn chọn một trong các lựa chọn của engine hoặc nêu điều cần thay đổi",
  viewTip: (rel) => `Đọc ${rel} trong dashboard`,
};

const status: StatusStrings = {
  runComplete: "Hoàn thành",
  runUnknown: "Không rõ trạng thái run",
  runSource: "state.md",
  running: "Đang chạy",
  runningSub: (stage, age) => `${stage} · bản ghi cuối ${age} trước`,
  runTip:
    "Bản ghi cuối là sự kiện mới nhất trong audit log. Nếu khoảng này cứ tăng, run không ghi gì cả",
  stuckNoRecord: "Chưa ghi nhận lần chặn nào",
  stuckClear: "Không bị kẹt",
  stuckEarlier: (stage) => `lần chặn cuối ở ${stage} · clone này`,
  stuckBlocked: (count) => `Bị chặn ${count}× mà không có tiến triển`,
  stuckSource: "stop hook · clone này",
  stuckTip:
    "block-count.json của stop hook. Tăng thêm một mỗi lần run cố dừng mà không có tiến triển, và về 0 khi công việc tiến lên. Ngưỡng mà engine bỏ cuộc nằm phía engine, nên không phán định ở đây",
  humanGate: (stage) => `Chờ phê duyệt: ${stage}`,
  humanGateSource: "gate đang mở · audit log",
  humanNone: "Không có gì chờ bạn",
  humanSource: "các file questions",
  checksNone: "Stage này chưa ghi nhận check nào",
  checksInFlight: (pending) => `${pending} check đang chạy`,
  checksFailed: (failed) => `Ghi nhận ${failed} check thất bại`,
  checksPassed: (passed) => `${passed} check đạt`,
  checksSource: "sensor · stage hiện tại · audit log",
  checksFailedTip:
    "Các lần sensor thất bại được ghi trong stage hiện tại. Bản tổng hợp này không biết lần kiểm tra lại sau đó có đạt hay không",
};

const overview: OverviewStrings = {
  sectionProgress: "Tiến độ",
  sectionUnitProgress: "Tiến độ unit (state.md, có thẩm quyền)",
  sectionMatrix: "Ma trận unit của Construction",
  runComplete: "hoàn thành",
  nowLabel: "hiện tại",
  updatedLabel: "cập nhật",
  kindArtifact: "artifact",
  kindQuestions: "câu hỏi / trả lời",
  kindDiary: "nhật ký stage",
  openInEditor: (rel) => `${rel} — mở bằng trình soạn thảo mặc định`,
  provisionalTip: "đang chạy — các con số này vẫn đang tăng",
  totalColumn: "tổng",
  unassignedOwner: "chưa giao",
  batchNote:
    "Các unit trong một batch có thể chạy song song — batch là thứ tự tô-pô theo phụ thuộc của chúng.",
  unitProgressNote:
    "<code>## Unit Progress</code> của state.md — một hình chiếu <b>có thẩm quyền</b> mà engine ghi lại ở mỗi lần\n  <code>next</code> từ biên nhận, review và gate. Sửa tay không bao giờ là bằng chứng định tuyến hay hoàn thành. Ma trận bên dưới là chẩn đoán riêng, dựng lại từ đĩa.",
  noUnits: "Chưa có thông tin unit — chưa tới units-generation.",
  noUnitsPill: "n/a",

  tipPartial: (missing) => `thiếu: ${missing.join(", ")}`,
  tipComplete: (present) => `hoàn thành: ${present.join(", ")}`,
  tipUnsettled: (present) =>
    `Đủ mọi artifact nhưng không có biên nhận hoàn thành (UNIT_COMPLETED) — unit có thể đang tạm dừng, chờ tiếp tục, hoặc chưa được phê duyệt (file: ${present.join(", ")})`,
  tipUnverified: (reason, present) => `${RECEIPT_REASON_VI[reason]} (file: ${present.join(", ")})`,
  tipNotApplicable: (present) =>
    `Không có gì được contract cho loại unit này${present.length ? ` (file hiện có: ${present.join(", ")})` : ""}`,
  tipNotStarted: "chưa bắt đầu",

  legendBase:
    "\u2588 hoàn thành (đã xác nhận biên nhận) · \u25a8 đã bắt đầu, artifact chưa đủ (rê chuột lên ô để xem thiếu gì) · · chưa bắt đầu",
  legendUnsettled:
    " · \u25a9 đủ mọi artifact nhưng không có biên nhận hoàn thành (UNIT_COMPLETED) — engine cũng coi unit này là chưa được phủ",
  legendUnverifiedNoFloor:
    " · \u25a4 không thể kiểm tra biên nhận hoàn thành chỉ từ audit ledger (rê chuột lên ô để xem lý do) — khi thiếu `Run floor`, engine coi unit là chưa được phủ và sẽ chạy lại",
  legendUnverified:
    " · \u25a4 không thể kiểm tra biên nhận hoàn thành chỉ từ audit ledger — đây KHÔNG phải phán định rằng công việc chưa xong (rê chuột lên ô để xem lý do)",
  legendNa:
    " · \u2013 không có gì được contract cho loại unit này (số trong ngoặc ở cột tổng là bao nhiêu ô như vậy)",
  legendUnverifiedContract:
    "Không thể đối chiếu State Version của state.md với harness, nên đây là <b>contract chưa được xác minh</b> — contract được hiển thị như đã đọc, nhưng trang này không bảo đảm các phán định hoàn thành khớp với engine",
  legendNoContract: (receiptAware) =>
    `Không có stage-graph.json, nên không thể phán định contract — một ô chỉ thể hiện sự hiện diện của file${receiptAware ? " và biên nhận hoàn thành" : ""}`,
};

const page: PageStrings = {
  warningsHeading: "Cảnh báo khi đọc",
  harnessNotFound: "không tìm thấy",
  pickFolder: "Đổi thư mục",
  wsMenuTip: "Chuyển workspace",
  wsHeading: "Workspace",
  wsNoOthers: "Không tìm thấy workspace nào khác.",
  wsLoading: "Đang tìm workspace…",
  wsLoadFailed: "Không tải được danh sách",
  wsCurrent: "hiện tại",
  wsTruncated: "Đã chạm giới hạn tìm kiếm. Nếu không thấy workspace của bạn, hãy duyệt để tìm.",
  reloadTitle:
    "Đọc lại ngay (r) — bắt được những chỉnh sửa mà polling có thể bỏ lỡ, như đổi SKIP\u2194EXECUTE bằng tay",
  reloadLabel: "Làm mới",
  footer: "Chỉ đọc — dashboard này không bao giờ ghi vào workspace.",
  langGroupLabel: "Ngôn ngữ trang",
  langEn: "English",
  langVi: "Tiếng Việt",

  jsReloading: "Đang làm mới",
  jsRefreshedPrefix: "cập nhật ",
  jsRefreshFailed: "Cập nhật thất bại — đang thử lại",
  jsOpenFailedStatus: "Không mở được ({status})",
  jsOpenFailedUnreachable: "Không mở được — server không phản hồi",
};

const health: HealthStrings = {
  sectionDiary: "Quyết định và vấn đề",
  sectionStream: "Audit ledger",
  kindDeviation: "thay đổi kế hoạch",
  kindDeviationTip: "Ghi lại điều đã lệch khỏi kế hoạch ban đầu giữa chừng, và lý do",
  kindTradeoff: "đánh đổi",
  kindTradeoffTip: "Ghi lại điều được và mất khi chọn giữa các phương án",
  kindInterpretation: "diễn giải",
  kindInterpretationTip: "Ghi lại cách hiểu một yêu cầu hoặc chỉ dẫn mơ hồ",
  kindResolved: "đã giải quyết",
  kindResolvedTip: "Đánh dấu một câu hỏi hoặc vấn đề còn mở trước đó là đã xong",
  kindFollowUp: "theo dõi",
  kindFollowUpTip: "Điều vẫn cần kiểm tra hoặc quyết định",
  kindNote: "ghi chú",
  kindNoteTip: "Một câu hỏi mở không nêu việc theo dõi hay cách giải quyết",
  sourceLink: "nguồn",
  openTip: (rel) => `Mở ${rel}`,
  noRecords: "Không có bản ghi.",
  more: (count) => `thêm ${count}`,
  stageRollup: (count) => `Mọi bản ghi theo stage · ${count} đã chuẩn hoá`,
  colStage: "stage",
  colDecision: "quyết định",
  colDeviation: "thay đổi",
  colFollowUp: "theo dõi",
  colResolved: "đã giải quyết",
  colNote: "ghi chú",
  colTotal: "tổng",
  noDiaryFiles: "Không có nhật ký stage (memory.md).",
  noDiaryRecords: "Không có quyết định hay vấn đề cần theo dõi nào được ghi.",
  statFollowUp: "theo dõi",
  statResolved: "đã giải quyết",
  statDeviation: "thay đổi kế hoạch",
  statDecision: "quyết định",
  tidyPill: "gọn",
  tidyPillTip: "Nghĩa là không còn mục cần theo dõi nào thiếu dấu giải quyết",
  tidyNote: "Không còn mục cần theo dõi nào chưa giải quyết.",
  headingFollowUp: "Mục cần theo dõi",
  headingRecentDecisions: "Quyết định gần đây",
  headingRecentDeviations: "Thay đổi kế hoạch gần đây",
  resolvedRecords: (count) => `${count} đã giải quyết`,
  emptyLedger: "Audit ledger trống.",
  filterLabel: "loại",
  filterAll: (total) => `tất cả (${total})`,
  streamMeta: (shown, total, shards) =>
    `hiển thị ${shown} mới nhất trên ${total} · ${shards} shard`,
  colTime: "thời gian",
  colEvent: "sự kiện",
  colStageUnit: "stage / unit",
  colDetail: "chi tiết",
};

const deferrals: DeferralStrings = {
  section: "Quyết định bị hoãn",
  faces: {
    passed: {
      label: "stage đã qua",
      tip: "Stage được giao quyết định này đã kết thúc, và không có câu trả lời nào được ghi. Engine không ghi dấu đóng, nên điều này nghĩa là 'không thấy', không phải 'đã bỏ'",
    },
    current: {
      label: "stage hiện tại",
      tip: "Stage đang chạy chính là stage nên hỏi điều này — đến hạn ở lượt này",
    },
    ahead: {
      label: "stage sau",
      tip: "Được giao cho một stage chưa bắt đầu — sẽ được hỏi khi run tới đó",
    },
    outOfScope: {
      label: "ngoài phạm vi",
      tip: "Là stage có thật, nhưng không nằm trong phạm vi run này (state.md) — sẽ không ai hỏi",
    },
    nextCycle: { label: "chu kỳ sau", tip: "Được đẩy ra ngoài chu kỳ này một cách tường minh" },
    unassigned: {
      label: "chưa giao",
      tip: "Không đọc được stage nào từ ô giao việc — không có chỗ để hỏi, mục này có thể đơn giản biến mất ở stage tiếp theo",
    },
  },
  ageTip: "Thời gian kể từ khi mục này được ghi lần đầu",
  sourceLink: "nguồn",
  viewTip: (rel) => `Đọc ${rel} trong dashboard`,
  editorLink: "trình soạn thảo",
  openTip: (rel) => `Mở ${rel}`,
  assignLabel: "giao cho",
  noneApplicable: "Không có.",
  more: (key, count) => `${key}: thêm ${count}`,
  ownerRollup: (stages) => `Theo stage được giao · ${stages} stage`,
  colOwner: "giao cho",
  colStatus: "trạng thái",
  colCount: "số lượng",
  assumptionPill: "giả định",
  assumptionPillTip: "Một giả định được mang sang stage sau — không nêu stage nào",
  assumptionSummary: (groups, mentions) =>
    `${groups} giả định${mentions > groups ? ` (được ghi ${mentions} lần trong các artifact)` : ""}`,
  assumptionNote: `Engine đánh dấu giả định là <code>[assumption]</code> và vẫn giữ nhãn đó cả khi bạn đã chấp nhận ở
  <code>## Assumption Confirmation</code> của stage — chấp nhận không biến giả định thành sự thật. Vì vậy trạng thái ở đây
  lấy từ câu trả lời đó: <b>đã chấp nhận</b> khi chính stage ghi ra nó đã hỏi và bạn trả lời <code>A. Accept assumptions</code>.
  Một bản chép lại ở stage sau mà stage đó không hỏi vẫn là <b>chưa xác nhận</b> — không có câu trả lời nào trỏ tới nó.
  Cùng một câu được chép lại ở nhiều artifact chỉ hiện một lần, kèm mọi nơi nó được ghi.`,
  assumptionStatus: {
    accepted: {
      label: "đã chấp nhận",
      tip: "Đã chấp nhận ở Assumption Confirmation của stage ghi ra nó — vẫn là giả định, sẽ làm rõ ở stage sau",
    },
    partial: {
      label: "chấp nhận một phần",
      tip: "Đã chấp nhận ở nơi được hỏi đầu tiên, nhưng được chép lại ở stage chưa hỏi về nó",
    },
    unconfirmed: {
      label: "chưa xác nhận",
      tip: "Chưa có câu trả lời Assumption Confirmation nào bao gồm nó",
    },
  },
  assumptionSources: (n) => `được ghi ở ${n} nơi`,
  assumptionAcceptedIn: "chấp nhận tại",
  diaryFollowUpPill: "theo dõi",
  diaryFollowUpTip: "Bản thân câu văn yêu cầu theo dõi hoặc ra quyết định",
  diaryNotePill: "mục mở trong nhật ký",
  diaryNoteTip:
    "Stage xếp mục này vào phần câu hỏi mở nhưng câu văn không có từ ngữ theo dõi — tiêu đề là lời khai báo, nên vẫn được tính",
  diarySummary: (count) => `${count} mục mở trong nhật ký stage — chưa giao`,
  diaryNote: (resolved) =>
    `Đọc từ <code>## Open questions</code> trong <code>memory.md</code>, không phải từ artifact —
  sổ mục mở thứ hai mà engine bắt buộc trong mọi nhật ký stage. Đây là ghi chú riêng của orchestrator chứ không phải
  contract với một stage sau, và không có ô giao việc, nên <b>không bao giờ cộng gộp</b> với các mục artifact ở trên.${
    resolved > 0 ? ` Đã loại ${resolved} mục được đánh dấu đã giải quyết.` : ""
  }`,
  ledgerItems: "mục mở trong artifact",
  ledgerItemsSource: "các mục mở dưới <code>## Assumptions &amp; Open Questions</code>",
  ledgerAssumptions: "giả định",
  ledgerAssumptionsSource:
    "các mục <code>[assumption]</code>, gộp theo nội dung; trạng thái lấy từ <code>## Assumption Confirmation</code> của từng stage",
  ledgerDiary: "mục mở trong nhật ký stage",
  ledgerDiarySource: "<code>## Open questions</code> trong <code>memory.md</code> của từng stage",
  chipUnassignedTip:
    "Chưa có câu trả lời Assumption Confirmation nào bao gồm nó — vẫn là giả định cho tới khi stage ghi ra nó hỏi và bạn chấp nhận",
  chipFollowUp: "theo dõi",
  chipFollowUpTip: "Bản thân câu văn yêu cầu theo dõi hoặc ra quyết định",
  chipOther: "khác",
  chipOtherTip:
    "Được xếp vào phần câu hỏi mở nhưng câu văn không có từ ngữ theo dõi — tiêu đề là lời khai báo, nên vẫn được tính",
  ledgersNote: `Ba sổ là <b>những cách đọc khác nhau</b> — chỉ hàng đầu có ô giao việc, hai hàng
còn lại không có nơi được giao để hỏi. <b>Chúng không được cộng gộp.</b>`,
  noSections: (artifacts) =>
    `Không artifact nào có phần <code>## Assumptions &amp; Open Questions</code> — hoặc run này không để lại
    sổ mục mở, hoặc chưa ghi artifact nào. (đã đọc ${artifacts} artifact)`,
  unreadSections: (sections, unread, emptySections) =>
    `${sections} artifact có phần <code>## Assumptions &amp; Open Questions</code>,
      và <b>${unread} trong số đó có dạng mà trình đọc này không biết</b> — không có bảng
      (<code>| item | assigned |</code>), không có thẻ <code>[assumption]</code>, và không có ledger id kiểu <code>**OQ1**</code>.
      <b>Điều đó không có nghĩa là không có mục mở; nó nghĩa là chúng chưa được đọc.</b>
      ${emptySections} phần khai báo tường minh <code>None.</code>.`,
  noOpenPill: "không có mục mở",
  noOpenPillTip: "Phần sổ có mặt và trống — một lời khai báo tường minh là 'không có'",
  allNone: (sections) => ` Mọi sổ mục mở trong ${sections} artifact đều ghi <code>None.</code>`,
  lead: (items, sections, rows, exits) =>
    `<b>${items}</b> mục mở · ${sections} artifact có sổ
  <code>## Assumptions &amp; Open Questions</code> (${rows} hàng thô → ${items} sau khi khử trùng lặp)${
    exits > 0
      ? ` · ${exits} mục được đẩy tường minh ra ngoài chu kỳ này không nằm trong con số đó`
      : ""
  }.
  Engine protocol nêu rằng <b>khi công việc phía sau cần một mục chưa giải quyết, nó sẽ hỏi tiếp</b> — nên không có gì
  ở đây đã biến mất, nó <b>sẽ được hỏi lại</b>. Engine cũng không ghi dấu đóng, vì vậy
  <b>'stage đã qua' nghĩa là không thấy câu trả lời, chứ không phải mục đã bị bỏ</b>.`,
  catalogMissingNote: `Không có stage catalogue, tên stage trong các ô giao việc chỉ được đối chiếu với
    state.md của run này — vì vậy một stage ngoài phạm vi có thể đã bị hạ xuống <b>chưa giao</b>.`,
  headingPassed: (count) => `Giao cho stage đã qua · ${count}`,
  headingCurrent: (count) => `Stage hiện tại nên hỏi · ${count}`,
  summaryAhead: (count) => `${count} mục giao cho stage sau — đến hạn khi run tới đó`,
  summaryRest: (count) => `${count} mục chưa giao hoặc ngoài chu kỳ này`,
};

const timeline: TimelineStrings = {
  section: "Phân tích thời gian",
  endKinds: {
    completed: "hoàn thành",
    skipped: "bỏ qua",
    "awaiting-approval": "chờ phê duyệt",
    "in-flight": "đang chạy",
    superseded: "bị thay bởi lần vào lại",
  },
  segmentTip: (stage, endKind, from, to, split) =>
    `${stage} — ${endKind}\n${from} → ${to}\n${split}`,
  splitLine: (wait, parked, observed, conversation, unknown) =>
    `người dùng chờ ${wait}phút · tạm dừng ${parked}phút · quan sát ${observed}phút · hội thoại ${conversation}phút · chưa phân loại ${unknown}phút`,
  zeroSecondTip: "0 giây — bắt đầu và hoàn thành trong cùng một giây",
  loadArtifacts: (n) => `artifact ${n}`,
  loadFailures: (n) => `thất bại ${n}`,
  loadDelegations: (n) => `ủy quyền ${n}`,
  loadHumanTurns: (n) => `người ${n}`,
  noStageSpans: "Audit ledger không có khoảng stage nào.",

  bucketWait: "người dùng chờ",
  bucketWaitTip: "Từ lúc gate hoặc câu hỏi mở cho tới khi có người trả lời",
  bucketParked: "tạm dừng",
  bucketParkedTip: "Những khoảng mà mọi clone CÓ MẶT lúc đó đều đang tạm dừng",
  bucketObserved: "thực thi quan sát được",
  bucketObservedTip:
    "Tổng các khoảng giữa sự kiện dưới 5 phút và các khoảng ủy quyền tường minh — không phải thời gian thuần của model hay CPU",
  bucketConversation: "hội thoại",
  bucketConversationTip:
    "Từ HUMAN_TURN của một clone tới HUMAN_TURN tiếp theo của chính clone đó. Bao gồm câu trả lời chat của engine (không để lại audit event) cùng với thời gian người đọc và gõ, và ledger không vạch ranh giới giữa chúng — nên không phải chờ cũng không phải thực thi, mà có nhóm riêng",
  bucketUnknown: "chưa phân loại",
  bucketUnknownTip:
    "Năm phút trở lên không có dấu mốc đáng tin — để trống thay vì tính là thực thi",

  windowTipOpen: (silence) =>
    `Sự kiện đầu → hiện tại. Khoảng ${silence} kể từ sự kiện cuối KHÔNG nằm trong phân tích bên dưới (không có bản ghi thì không thể phân loại).`,
  windowTipClosed: "Sự kiện đầu → sự kiện cuối",
  windowTeam: "thời gian thực của team",
  windowSolo: "tổng thời gian trôi qua",
  windowSub: (classified) => `Tỉ lệ bên dưới chia cho <b>${classified} đã phân loại</b>`,
  unrecordedPill: (silence) => `${silence} không được ghi kể từ sự kiện cuối`,
  clonesPill: (clones) => `${clones} clone`,
  delegated: (h) => ` · ủy quyền ${h}`,
  inFlight: (list) => `Đang chạy: ${list}`,
  noneInFlight: "Không có stage nào đang chạy",
  awaiting: (stage) => `chờ phê duyệt: <b>${stage}</b>`,
  awaitingNone:
    'không có stage nào chờ phê duyệt<span class="mute"> (hiện không có gì chờ ở gate — các lần nộp trước nằm trong bảng làm lại bên dưới)</span>',
  reworkPending: " · có stage bị từ chối và chưa được phê duyệt lại",
  mergedNote: (workers, clones) =>
    `Đã gộp ${workers} ledger (${clones} clone) — phân tích ở trên là
       con số <b>toàn team</b> trên mọi bản ghi xếp chung một dòng. Thời gian theo từng người xem ở <b>phân tích theo worker</b>.`,
  axisSilenceTip: (silence) =>
    `${silence} kể từ sự kiện cuối — không được ghi, nên để ở dạng chưa phân loại`,

  reworkSummary: (rejected, h) => `Làm lại — ${rejected} lần từ chối · ${h}`,
  reworkNone: "Không có từ chối hay sửa đổi nào — mọi gate đều qua ngay lần đầu.",
  reworkProvisionalTip: "Chưa được phê duyệt — thời gian này vẫn đang tăng",
  feedbackCount: (n) => `${n}`,
  reasonsSummary: (n) => `${n} lý do từ chối do người viết — đầy đủ`,
  reasonsNote: `Sao chép nguyên văn từ <code>**Feedback**</code> trong ledger. Trùng lặp giữa cặp từ chối/sửa đổi
  được loại bỏ và giữ tối đa 6 mục mỗi stage — không tóm tắt hay cắt bớt gì.`,
  reworkStatShare: (share) => `làm lại ${share}%`,
  statRejected: "từ chối",
  statApproved: "phê duyệt",
  statRevisions: "vòng sửa đổi",
  statJumps: "nhảy stage",
  statFreezeBlocked: "chỉnh sửa bị chặn khi review",
  colSubmissions: "đã nộp",
  colSubmissionsTip: "STAGE_AWAITING_APPROVAL — số lần được đưa tới gate",
  colRejections: "từ chối",
  colRevisions: "sửa đổi",
  colRevisionsTip: "Số vòng sửa đổi / số Revision cộng dồn trong state.md",
  colRework: "làm lại",
  colReworkTip: "Lần từ chối đầu → lần phê duyệt cuối",
  colReason: "lý do",
  colReasonTip: "Lý do từ chối do người viết — toàn văn nằm dưới bảng",
  reworkNote: (share, classified, provisional) =>
    `Làm lại = <b>từ lần từ chối đầu tới lần phê duyệt cuối</b>. Một stage bị từ chối hai lần bao gồm cả lần phê duyệt
  ở giữa: đây đo "thời gian chưa được chấp nhận", không phải tổng các vòng — ledger không có dấu đóng cho một
  vòng sửa đổi. ${share}% là trên khoảng đã phân loại (${classified}).${
    provisional
      ? " Các stage đánh dấu <b>~</b> chưa được phê duyệt, nên thời gian vẫn tiếp tục tăng."
      : ""
  }`,

  colStage: "stage",
  colTrack: "chiếm dụng",
  colTotalMin: "tổng (phút)",
  colWait: "người dùng chờ",
  colParked: "tạm dừng",
  colObserved: "quan sát",
  colConversation: "hội thoại",
  colConversationTip:
    "Từ lượt người này tới lượt kế tiếp — câu trả lời chat của engine và thời gian người đọc, gõ trộn lẫn với nhau, nên không tính vào bên nào.",
  colUnknown: "chưa phân loại",
  colWorkEstimate: "ước lượng công việc",
  colWorkEstimateTip:
    "Quan sát + chưa phân loại — khoảng thời gian trừ đi người dùng chờ, tạm dừng và hội thoại. Không phải thời gian thực thi mà là 'thời gian không giải thích được bằng chờ đợi', và chính cột này, chứ không phải tổng (phút), cho biết stage nào tốn kém.",
  colWorkload: "khối lượng",
  ganttLegend: `<b>Độ dài</b> của thanh là thời gian lịch chiếm dụng; <b>phần tô</b> là cách chia của chính khoảng đó —
  <i class="lg wait"></i>chờ · <i class="lg parked"></i>tạm dừng · <i class="lg observed"></i>quan sát ·
  <i class="lg conv"></i>hội thoại · <i class="lg unknown"></i>chưa phân loại. Viền cho biết stage kết thúc thế nào:
  xanh mòng két=hoàn thành · xám=bỏ qua · cam=chờ phê duyệt · xanh dương=đang chạy · nét đứt=bị thay bởi lần vào lại
  (lần thử đó kết thúc và stage bắt đầu lại). Stage 0 giây được vẽ bằng một vạch, không phải thanh.
  <b>Đọc stage nào tốn kém từ cột «ước lượng công việc», không phải từ độ dài thanh</b> — thanh dài nhất có thể
  toàn là chờ đợi.`,
  observedCaveat: `Thực thi quan sát được là tổng các khoảng giữa sự kiện dưới 5 phút và các khoảng ủy quyền tường minh, không phải
  thời gian thuần của model hay CPU. <b>Hội thoại</b> tính từ lượt người này tới lượt kế tiếp — câu trả lời chat của engine không để lại audit
  event, nên khoảng đó chứa công việc của engine cùng với thời gian người đọc và gõ, và vì ledger không có ranh giới
  nên nó <b>không được tính vào bên nào</b>.`,
  unknownGapsSummary: (count) => `${count} khoảng chưa phân loại từ 5 phút trở lên (top 12)`,
  unknownGapsNote:
    "Những khoảng không thể xác định là chờ, tạm dừng hay thực thi, nên được loại khỏi thời gian thực thi.",
  minutes: (min) => `${min}phút`,
  inferredPark: (h, anomalies) =>
    `${h} thời gian tạm dừng được suy ra từ các sự kiện tiếp tục session${
      anomalies > 0 ? ` · ${anomalies} bất thường ở dấu tạm dừng` : ""
    }.`,

  workerShapeOverlap: (clones, overlap) => `${clones} clone · ${overlap} làm việc đồng thời`,
  workerShapeSequential: (clones, handover) =>
    `${clones} clone · bàn giao tuần tự (không chồng lấn)${handover ? ` · khoảng bàn giao ${handover}` : ""}`,
  workerSummary: (shape) => `Phân tích theo worker — ${shape}`,
  leadTag: "lead",
  leadTagTip: "Đã qua approval gate = clone điều khiển workflow",
  noUnitAttribution: "Audit ledger không có thông tin gán unit",
  personTotal: "tổng giờ công",
  personParallelism: "mức song song hiệu dụng",
  colClone: "clone",
  colEvents: "sự kiện",
  colSpanMin: "khoảng (phút)",
  colGates: "gate",
  colMainStage: "stage chính",
  colUnits: "unit",
  workerNote: (teamIdle, deltaNote) =>
    `Mỗi hàng được tính từ <b>riêng dòng thời gian của clone đó</b> = "mỗi người đã chờ bao lâu".
  Tổng tạm dừng+chờ toàn team ở trên (${teamIdle}) gộp mọi bản ghi lên một dòng.
  ${deltaNote}`,
  deltaSame: "Hai con số gần như bằng nhau.",
  deltaOverlapUnder: (delta, overlap) =>
    `Trong ledger gộp, sự kiện của người khác lấp vào thời gian chờ của tôi, nên con số <b>thấp hơn ${delta}</b>
             (các clone làm việc đồng thời ${overlap}).`,
  deltaOverlapOver: (delta) =>
    `Ledger gộp <b>cao hơn ${delta}</b> — khoảng bàn giao không chồng lấn là thời gian dừng toàn team,
             nhưng không có trong dòng thời gian của cá nhân nào.`,
  deltaHandoverUnder: (delta) =>
    `Chênh lệch <b>${delta}</b> là do bàn giao, không phải chồng lấn — các clone không bao giờ trùng thời gian
             (chồng lấn 0), nên việc một clone tạm dừng không thể đọc ở mức toàn team như sự vắng mặt của clone khác.`,
  deltaHandoverOver: (delta, handover) =>
    `Ledger gộp <b>cao hơn ${delta}</b> — khoảng bàn giao giữa các clone
             (${handover}) là thời gian dừng toàn team nhưng không có trong dòng thời gian của cá nhân nào.`,
  hostNote: (workers, clones) =>
    `Một số trong ${workers} ledger là <b>cùng một working copy</b> dưới tên host khác —
         số clone là ${clones}.`,
  endedParked: (label, at) => `<b>${label}</b> kết thúc ở trạng thái tạm dừng lúc ${at}`,
  endedParkedTail: " — một ledger không bao giờ quay lại.",
  parallelismNote: `Mức song song hiệu dụng = giờ công ÷ thời gian thực của team. Nó chỉ có ý nghĩa khi có
       công việc đồng thời, nên bị ẩn khi chồng lấn bằng 0.`,
  unitColumnNote: `Clone hiển thị "—" ở cột unit có <code>Output path</code> trong ledger là đường dẫn code
  chứ không phải artifact, nên không truy ngược được unit — chỉ chắc chắn stage mà nó đã làm.`,
};

const picker: PickerStrings = {
  docTitle: "Chọn workspace AI-DLC",
  heading: "Chọn workspace",
  currentMark: "hiện tại",
  launchMark: "tìm thấy nơi bạn khởi chạy",
  recentMark: "đã mở trước đây",
  workspaceKind: "workspace AI-DLC",
  openAction: "Mở",
  tagWorkspace: "workspace",
  tagAidlcTree: "cây aidlc",
  tagUnreadable: "không đọc được",
  open: "Mở",
  openThisFolder: "Mở thư mục này",
  explorerEmpty: "Không có thư mục con để hiển thị.",
  explorerHeading: "Duyệt thư mục",
  explorerRootsLabel: "Gốc duyệt",
  breadcrumbLabel: "Đường dẫn hiện tại",
  filterLabel: "Lọc tên thư mục trong thư mục này",
  filterPlaceholder: "Lọc tên thư mục",
  filterClear: "Xoá bộ lọc",
  showHidden: "Hiện thư mục ẩn",
  hideHidden: "Ẩn thư mục ẩn",
  filterNoMatch: "Không có thư mục nào khớp.",
  noWorkspacesFound: "Không tìm thấy workspace nào.",
  foundSuffix: " đã tìm thấy",
  scanned: (count) => `đã quét ${count} thư mục`,
  manualHeading: "Mở theo đường dẫn",
  manualLabel: "Đường dẫn workspace",
  manualButton: "Mở workspace",
  manualNote: "Đường dẫn gốc chứa thư mục <code>aidlc/</code> · dùng được <code>~</code>",
  foundHeading: "Workspace đã tìm thấy",
  rescan: "Quét lại",
  removeAction: "Xóa",
  removeHint: "Chỉ xóa khỏi danh sách trên trình duyệt này. Giữ nguyên dữ liệu project.",
  restoreRemoved: (count) => `Hiện lại workspace đã xóa (${count})`,
  foundFilterLabel: "Lọc workspace theo tên hoặc đường dẫn",
  foundFilterPlaceholder: "Lọc workspace",
  foundNoMatch: "Không có workspace nào khớp.",
  foundFiltered: (shown, total) => `${shown} / ${total}`,
  viewLabel: "Kiểu hiển thị",
  viewCards: "Thẻ",
  viewList: "Danh sách",
  showMore: (n) => `Hiện thêm ${n}`,
  showLess: "Thu gọn",
  truncated: "Đã chạm giới hạn quét. Bạn có thể nhập đường dẫn trực tiếp ở trên.",
  summaryPctLabel: "hoàn thành",
  summaryBlockersLabel: "vướng mắc",
  summaryNoRunNone: "chưa ghi nhận run nào",
  summaryNoRunAmbiguous: "nhiều intent · không có con trỏ active",
  summaryUnreadable: "không đọc được state.md",
  summaryFailed: "không tải được",
  summaryProgressTip: (done, total, asOf) =>
    `${done}/${total} theo state.md · cập nhật ${asOf} (đóng dấu khi chuyển stage, nên trễ khi đang giữa stage)`,
  summaryBlockersTip: (asked) => `chưa trả lời trên ${asked} câu hỏi · vừa đọc từ đĩa`,
  footer: (path) => `Workspace hiện tại · <code>${path}</code> ·
         <a href="/">Quay lại dashboard</a>`,
};

const usage: UsageStrings = {
  windowLong7d: "7 ngày qua",
  windowLong30d: "30 ngày qua",
  windowLongAll: "toàn bộ",
  window7d: "7n",
  window30d: "30n",
  windowAll: "tất cả",
  trendToggleLabel: "Khoảng xu hướng",
  tokenToggleLabel: "Khoảng tổng hợp",

  creditSection: "Credit",
  statusLoading: "đang thu thập",
  statusOk: "ok",
  statusPartial: "dữ liệu một phần",
  statusFailure: "thu thập thất bại",
  statusNone: "không có dữ liệu",
  rowPlan: "gói",
  rowUsed: "đã dùng",
  rowRemaining: "còn lại",
  rowLimit: "hạn mức gói",
  rowRatio: "mức dùng",
  ratioUnavailable: "không tính được mức dùng",
  ratioLabel: (pct) => `mức dùng ${pct}`,
  fetchFailed: (reason) =>
    `Không lấy được dữ liệu mới nhất (${reason}). Dưới đây là lần đọc thành công gần nhất.`,
  rawSummary: "Hiện output lỗi thô",
  rawEmpty: "(không có output)",
  stalePill: "dữ liệu cũ",
  firstCollection: "Đang thu thập mức dùng credit lần đầu.",
  noCreditYet: "Chưa thu thập dữ liệu credit nào. Dữ liệu sẽ hiện ở đây khi việc thu thập chạy.",
  staleNote: "Đã hơn 10 phút kể từ lần thành công gần nhất — các số liệu này có thể không còn mới.",
  pollHalted: (failures, retryEvery) =>
    `Sau ${failures} lần thất bại liên tiếp, chu kỳ thu thập tự động được nới ra ${retryEvery} phút, để không gọi một nguồn đang hỏng mỗi năm phút. Số liệu bên dưới là lần thành công gần nhất; một lần thu thập thành công sẽ khôi phục chu kỳ bình thường. Nút làm mới thử lại ngay.`,
  pollHaltedReason: (reason) => `Lần thất bại gần nhất: ${reason}`,
  lastSuccess: (at) => `Lần thành công gần nhất: ${at}`,
  chartEmpty: (w) => `Xu hướng mức dùng cộng dồn, ${w}: không có dữ liệu để hiển thị`,
  chartSummary: (w, min, max, latest) =>
    `Xu hướng mức dùng cộng dồn, ${w}: nhỏ nhất ${min}, lớn nhất ${max}, mới nhất ${latest}`,
  chartNoData: "Không có dữ liệu để hiển thị",

  tokenSection: "Token usage",
  tokenPartial: "đếm một phần",
  rowTokenTotal: "tổng token",
  rowInput: "input",
  rowOutput: "output",
  rowThinking: "thinking (đã gồm trong output)",
  rowCacheRead: "cache read",
  rowCacheCreate: "cache create",
  rowCachedPrompt: "tỉ lệ trúng prompt cache",
  rowCachedPromptTip:
    "cache read ÷ (input + cache read + cache create). Tỉ lệ token prompt được phục vụ từ cache; output không nằm trong mẫu số.",
  rowSessions: "session",
  rowMessages: "tin nhắn assistant",
  colModel: "model",
  colShare: "tỉ lệ",
  tokenChartEmpty: (w) => `Xu hướng token theo ngày, ${w}: không có dữ liệu để hiển thị`,
  tokenChartSummary: (w, days, min, max, latest) =>
    `Xu hướng token theo ngày, ${w}: ${days} ngày, nhỏ nhất ${min}, lớn nhất ${max}, mới nhất ${latest}`,
  noTokens: "Không có token usage Claude Code nào trong khoảng này. Hãy thử mở rộng khoảng.",
  span: (range) => `Khoảng: ${range}`,
  sidechain: (count) => `${count} câu trả lời của subagent đã được tính vào tổng ở trên.`,
  rowSessionWall: "thời gian thực của session",
  rowSessionApi: "trong đó API",
  rowSessionTool: "trong đó thực thi tool",
  rowSessionCount: "session có checkpoint",
  sessionCrossCheck:
    "Đọc từ các checkpoint mà Claude Code ghi cho mỗi session. Đây là nguồn độc lập với audit ledger mà bảng thời gian dùng để tính, nên nó là phép đối chiếu: khi hai nguồn lệch nhau, audit ledger có thẩm quyền. Session không ánh xạ lên stage, nên không thể chia theo stage. Checkpoint được ghi giữa session, nên số này có thể thấp hơn số `session` ở trên — một session đang chạy có thể chưa ghi checkpoint.",
  sessionStraddling: (count) =>
    `${count} session vắt qua mép khoảng và bị loại khỏi tổng ở trên — bản ghi là tổng cộng dồn theo session, nên không thể cắt.`,
  sessionAllStraddling: (count) =>
    `Không có session nào nằm trọn trong khoảng này — ${count} session vắt qua mép. Hãy thử khoảng rộng hơn.`,
  noteNoTranscripts: (triedPath) =>
    `Không tìm thấy transcript Claude Code (${triedPath}). Hoặc workspace này chưa từng được Claude Code điều khiển, hoặc nó chạy từ một đường dẫn khác.`,
  noteFilesCapped: (count) =>
    `Transcript quá lớn, nên ${count} file cũ hơn không được đọc — số liệu bên dưới thiếu đúng phần đó.`,
  noteUnreadableFiles: (count) => `Không đọc được ${count} file transcript.`,
  noteMalformedLines: (count) => `Đã bỏ qua ${count} dòng sai định dạng.`,
};

const errorPage: ErrorPageStrings = {
  docTitle: "AI-DLC dashboard",
  heading: "Không thể hiển thị workflow này",
  triedPathLabel: "Đường dẫn đã đọc: ",
  checkThis: `Kiểm tra rằng các con trỏ <code>&lt;root&gt;/aidlc/active-space</code> và
<code>&lt;root&gt;/aidlc/spaces/&lt;space&gt;/intents/active-intent</code> trỏ tới một bản ghi có tồn tại.`,
  pickAnother: "Chọn thư mục khác",
  readFailed: (message) => `Lỗi đọc: ${message}`,
  noSelection: "(chưa chọn gì)",
  notAWorkspace: (dir) => `${dir} không có thư mục aidlc/ — đây không phải workspace.`,
  noWorkspaceSelected: "Chưa chọn workspace.",
};

const cli: CliStrings = {
  needValue: (flag) => `${flag} cần một giá trị`,
  mustBeNumber: (flag, raw) => `${flag} phải là số: ${raw}`,
  msFloor: (flag, floor, zeroOk, got) =>
    `${flag} tính bằng mili giây và phải ít nhất ${floor}${zeroOk ? " (0 để tắt)" : ""}: ${got}`,
  portRange: (max, got) => `--port phải nằm trong khoảng 1 đến ${max}: ${got}`,
  badHost: (flag, raw, wildcardOk) =>
    `${flag} phải là địa chỉ IP (không dùng hostname${wildcardOk ? "" : ", 0.0.0.0 hay ::"}): ${raw}`,
  exposed: (url) =>
    `⚠️ Đang mở ra mạng tại ${url} — không có xác thực. Bất kỳ ai truy cập được địa chỉ này đều thấy dashboard và bộ chọn thư mục`,
  needRoot: "--root cần một đường dẫn",
  pathMissing: (path) => `Không có đường dẫn này: ${path}`,
  notAWorkspace: (path) => `Không có thư mục aidlc/ — không phải gốc workspace AI-DLC: ${path}`,
  harnessMissing: (path) => `Thư mục truyền cho --harness không tồn tại: ${path}`,
  needUsage: "--usage cần một giá trị (auto|kiro|claude)",
  badUsage: (raw) => `--usage phải là một trong auto|kiro|claude: ${raw}`,
  needLang: "--lang cần một giá trị (en|vi)",
  badLang: (raw) => `--lang phải là một trong en|vi: ${raw}`,
  unknownArg: (arg) => `Tham số không xác định: ${arg}`,
  noRootPicker: "Không có --root — hãy chọn thư mục trong trình duyệt",
  manualRefreshFailed: (detail) => `Làm mới thủ công thất bại (đã cô lập): ${detail}`,
  routeFailed: (route) => `${route} thất bại:`,
  creditBootFailed: (detail) =>
    `Không khởi động được hệ thống credit (dashboard vẫn đang khởi động): ${detail}`,
  unhandled: "Lỗi chưa được xử lý:",
  harnessNotFound: "không tìm thấy",
  startupSummary: (audit, langDefault) => `audit ${audit} · lang mặc định ${langDefault}`,
  intentAmbiguous: (root) => `Có nhiều intent nhưng không có con trỏ active-intent: ${root}`,
  noWorkflow: (root) => `Không tìm thấy workflow AI-DLC: ${root}`,
};

const openFile: OpenFileStrings = {
  badRel: "Đường dẫn rỗng hoặc quá dài",
  badChars: "Đường dẫn chứa ký tự không được phép",
  outsideRecord: "Không thể mở đường dẫn nằm ngoài thư mục bản ghi",
  extension: (allowed) => `Không thể mở phần mở rộng này (chỉ ${allowed.join(" / ")})`,
  symlinkEscape: "Symlink trỏ ra ngoài thư mục bản ghi",
  notFound: "Không có file này",
  statFailed: "Không đọc được metadata của file",
  notAFile: "Không phải file thông thường",
  platformUnsupported: (platform) => `Mở file không được hỗ trợ trên nền tảng này (${platform})`,
  interpreterMetachars: "Tên file chứa metacharacter của trình thông dịch — từ chối",
  openerMissing: (cmd) => `Không tìm thấy lệnh mở ${cmd} trên PATH`,
  spawnFailed: (detail) => `Không mở được: ${detail}`,
  spawnFailedLog: (cmd, detail) => `Không mở được file (${cmd}): ${detail}`,
  readFailed: (detail) => `Không đọc được file: ${detail}`,
};

const viewer: ViewerStrings = {
  docTitle: (rel) => `${rel} — nguồn`,
  back: "Dashboard",
  openInEditor: "Mở trong trình soạn thảo",
  size: (bytes) => `${bytes}`,
  truncated: (shown, total) =>
    `Đang hiển thị ${shown} đầu trên ${total}. Mở file trong trình soạn thảo để đọc phần còn lại.`,
  refusalHeading: "Không thể hiển thị nguồn này",
  empty: "File này trống.",
};

const explorer: ExplorerStrings = {
  rootHome: "Home",
  rootCurrent: "Hiện tại",
  volume: (name) => `Ổ đĩa ${name}`,
  mount: (name) => `Mount ${name}`,
  media: (name) => `Media ${name}`,
  browseFailed: (dir, message) => `Không mở được ${dir}: ${message}`,
};

const freshness: FreshnessStrings = {
  graphBehind: (lag, drift) =>
    `Chậm hơn audit ledger ${lag} — snapshot này chỉ được biên dịch lại khi chuyển stage${drift ? `. ${drift}` : ""}`,
  graphUnreadable:
    "Không đọc được runtime-graph.json — chưa tới units-generation, hoặc chưa đồng bộ",
  stageGraphMissing: "Không có stage-graph.json — bỏ qua phán định artifact-contract",
  sensorDrift: (fired, missing) =>
    `${missing} trong ${fired} lần sensor chạy ghi trong audit ledger không có trong snapshot này`,
};

const cards: CardStrings = {
  stageTitle: "Stage",
  unitTitle: "Unit",
  unresolvedTitle: "Unresolved",
  healthTitle: "Run Health",
  colStage: "stage",
  colWorkChat: "làm việc+chat",
  workChatTip:
    "Thời gian audit ledger phân loại là làm việc (khoảng dày sự kiện và ủy quyền) cộng hội thoại (giữa các lượt người). Thời gian chờ người, tạm dừng và khoảng chưa phân loại bị loại ra",
  unitsDone: (done, total) => `unit ${done}/${total}`,
  noStages: "Phase này không có stage nào",
  colUnit: "unit",
  colArtifacts: "artifact",
  cellLabel: {
    complete: "xong",
    partial: "một phần",
    unsettled: "chưa có biên nhận",
    unverified: "không kiểm chứng được",
    absent: "chưa bắt đầu",
    "n/a": "n/a",
  },
  decisionsTab: "Quyết định còn mở",
  openQsTab: "Câu hỏi còn mở",
  colItemOwner: "mục → stage phụ trách",
  colAge: "tuổi",
  noDecisions: "Không có quyết định còn mở",
  noOpenQs: "Không có câu hỏi còn mở",
  answersTab: "Câu trả lời của bạn",
  stuckTab: "Bị kẹt",
  checksTab: "Check thất bại",
  summaryTab: "Tóm tắt",
  colAsk: "câu hỏi · file",
  colWait: "đang chờ",
  colGuard: "stop hook",
  colCount: "số lần chặn liên tiếp",
  colCheck: "check · stage",
  colWhen: "lúc",
  moreRows: (n) => `+${n} nữa`,
  moreTimeline: "Mở toàn bộ timeline Gantt",
  moreMatrix: "Mở ma trận stage × unit",
  moreDeferrals: "Mở toàn bộ danh sách",
  drillsHeading: "Chi tiết",
  sourcesLabel: "Nguồn",
  sourceAge: (age) => `${age} trước`,
  sourceMissing: "không có bản ghi",
  sourceStale: "cũ",
  sourceNames: {
    disk: "file",
    audit: "audit",
    "state.md": "state.md",
    "runtime-graph": "runtime-graph",
    "hooks-health": "stop hook",
    "stage-graph": "stage-graph",
  },
};

const kpi: KpiStrings = {
  heading: "Số liệu chính",
  progressLabel: "Tiến độ",
  progressSub: (done, total) => `${done}/${total} stage · state.md`,
  usageLabel: "Mức dùng",
  creditSub: (limit, pct) =>
    limit === undefined ? "Credit Kiro · không rõ hạn mức" : `Credit Kiro · ${pct} trên ${limit}`,
  tokenSub: (window) => `Token đo được, ${window} · không có hạn mức cục bộ`,
  usageNone: "Chưa ghi nhận mức dùng",
  timeLabel: "Làm việc + chat",
  timeSub: (work, chat) => `làm việc ${work} · chat ${chat} · audit`,
  timeExcluded: (unknown) => `${unknown} chưa phân loại, không tính`,
  timeTip:
    "Thời gian làm việc quan sát được cộng thời gian hội thoại. Thời gian chờ người, tạm dừng, khoảng chưa phân loại và khoảng sau sự kiện cuối bị loại ra. Đây không phải thời gian thực đã trôi qua.",
  personTime: (total, clones, concurrent) =>
    concurrent
      ? `${clones} clone làm việc cùng lúc — con số là của team; ${total} giờ công`
      : `${clones} clone làm việc lần lượt — con số là của team; ${total} giờ công`,
  progressChartTitle: "Stage hoàn thành lần đầu, cộng dồn",
  progressChartNote:
    "Mỗi stage slug được đếm một lần, tại STAGE_COMPLETED đầu tiên trong audit. Các lần lặp theo unit của Construction và các lần chạy lại sau không được phản ánh, nên stage được mở lại vẫn tính là hoàn thành. Con số tiến độ ở trên là số checkbox trong state.md, nên hai con số có thể khác nhau.",
  progressChartAria: (completed) => `Số stage hoàn thành cộng dồn, hiện tại ${completed}`,
  timeChartTitle: "Thời gian làm việc + chat mỗi 6 giờ",
  timeChartAria: (total, bins) =>
    `Thời gian làm việc + chat qua ${bins} khoảng sáu giờ, tổng ${total}`,
  binTip: (start, work, chat, wait, parked, unknown) =>
    `6 giờ từ ${start} — làm việc ${work} · chat ${chat} · chờ người ${wait} · tạm dừng ${parked} · chưa phân loại ${unknown}`,
  legendWork: "làm việc",
  legendChat: "chat",
  legendSilence: "kể từ sự kiện cuối",
  noEvents: "Không có audit event",
};

export const VI: Strings = {
  locale: "vi",
  warn,
  blockers,
  status,
  overview,
  page,
  health,
  deferrals,
  timeline,
  picker,
  usage,
  errorPage,
  cli,
  openFile,
  viewer,
  explorer,
  freshness,
  cards,
  kpi,
};
