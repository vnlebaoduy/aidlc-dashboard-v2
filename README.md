<h1 align="center">AI-DLC Dashboard v2</h1>

<p align="center">An honest, at-a-glance read of an AI-DLC v2 run.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/vnlebaoduy/aidlc-dashboard-v2?color=ffc708&label=license" alt="License: MIT"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/actions/workflows/ci.yml"><img src="https://github.com/vnlebaoduy/aidlc-dashboard-v2/actions/workflows/ci.yml/badge.svg?branch=main" alt="verify workflow status"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/releases"><img src="https://img.shields.io/github/v/release/vnlebaoduy/aidlc-dashboard-v2?sort=semver&color=ffc708&label=release" alt="Latest release"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/releases"><img src="https://img.shields.io/github/downloads/vnlebaoduy/aidlc-dashboard-v2/total?color=ffc708&label=downloads" alt="Release downloads"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/stargazers"><img src="https://img.shields.io/github/stars/vnlebaoduy/aidlc-dashboard-v2?color=ffc708&label=stars" alt="Stars"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/issues"><img src="https://img.shields.io/github/issues/vnlebaoduy/aidlc-dashboard-v2?label=issues" alt="Open issues"></a>
  <a href="https://github.com/vnlebaoduy/aidlc-dashboard-v2/commits/main"><img src="https://img.shields.io/github/last-commit/vnlebaoduy/aidlc-dashboard-v2?label=last%20commit" alt="Last commit"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.4%2B-000000?logo=bun&logoColor=white" alt="Bun 1.4+">
  <img src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript 5.9">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/docs-English%20%2B%20Ti%E1%BA%BFng%20Vi%E1%BB%87t-0070c9" alt="Documentation in English and Vietnamese">
</p>

A read-only web dashboard for an [AI-DLC](https://github.com/awslabs/aidlc-workflows) run.
It shows whether the run is moving, what needs you, how far along it is, where the
time went, which decisions were deferred, and what it cost. Each question gets its
own page.

**Built for AI-DLC v2 only.** It reads the v2 record layout
(`aidlc/spaces/<space>/intents/<record>/`) and does not work with v1 trees. The v1
dashboard lives at [wowzoo/aidlc-dashboard](https://github.com/wowzoo/aidlc-dashboard).

**The workspace is read-only.** Nothing is ever written to the run you are looking
at; the only files written are the dashboard's own `data/usage.db` and
`data/recent-workspaces.json`, both outside any workspace. The server binds
loopback and has no authentication — treat it as a local tool.

## What it answers

| Question | Page |
|---|---|
| Is it moving? What needs me? | `/` Overview — KPI trio, four summary cards, plus an Outcomes card when the run has an `OUTCOMES.md` |
| How far along is it? | `/stages` — phases → stages → artifacts, unit progress, stage × unit matrix |
| Where did the time go? | `/timeline` — time buckets, gantt, rework, workers, unknown gaps |
| What is still undecided? | `/decisions` — deferred decisions, owners, open questions |
| What did it cost? | `/usage` — Kiro credit or Claude Code tokens, window 7d / 30d / all |
| Can I trust these numbers? | `/sources` — freshness of every input, read warnings |

## Highlights

- **One model, every page.** One polled request feeds the whole client, so pages never
  disagree and switching pages costs nothing.
- **Notifications that respect the reader.** Gates, unanswered questions, blocked
  stages, failed checks and a completed run raise a toast, an optional OS
  notification, a bell entry and a `(N)` tab title. Milestones are optional.
- **Markdown that is safe to read.** Record artifacts open in Preview or Raw.
  Answer files mark the chosen option, Mermaid diagrams render with strict security
  as inert images, and workspace text is never turned into markup.
- **Two audiences, one server.** Complete English and Vietnamese UI
  (`?lang=en` / `?lang=vi`, remembered by cookie), light and dark themes, usable
  down to 375 px.
- **A picker that remembers.** Discovery, a folder browser and open-by-path.
  Workspaces can be removed from the found list per browser without touching disk,
  and folder navigation keeps your scroll position.

## Requirements

- [Bun](https://bun.sh) 1.4 or newer. Nothing else: the server, the tests and the
  build all run on Bun.
- An AI-DLC v2 workspace (a directory containing `aidlc/` with an intent record).

## Quick start

### From a release

Download the archive from [Releases](https://github.com/vnlebaoduy/aidlc-dashboard-v2/releases),
unpack it, then:

```bash
bun run start -- --root ~/path/to/workspace   # http://127.0.0.1:4321
```

The archive already contains the built client, so there is nothing to install and no
build step. Without `--root` the app opens the workspace picker.

### From source

```bash
git clone https://github.com/vnlebaoduy/aidlc-dashboard-v2.git
cd aidlc-dashboard-v2
bun install && (cd web && bun install)
bun run build                 # typecheck + web/dist
bun run start -- --root ~/path/to/workspace
```

## Develop

```bash
bun run dev -- --root fixtures/reference
```

Open **http://127.0.0.1:5173**. Vite serves the UI with HMR; the API runs on `:4329`
with `--watch`, and Vite proxies `/api`, `/select` and `/open` to it. Port 4329
keeps dev clear of a dashboard already running on the default 4321.
`fixtures/reference` is a small synthetic run that exercises every page.

To open dev from another machine by IP, add `--host 0.0.0.0` (or set
`AIDLC_DEV_HOST`):

```bash
bun run dev -- --host 0.0.0.0 --root fixtures/reference   # http://<machine-ip>:5173
```

Only the UI port is exposed. The API stays on loopback and is reached through
Vite's proxy. Vite refuses unknown `Host` names, so DNS rebinding still fails, and
the cross-site guard still applies to `/select`, `/open` and `/api/refresh`.
**No authentication:** anyone who can reach the IP sees the dashboard and the
folder picker. For production exposure use the server's own `--host` /
`--allow-host` (see below).

| Script | Does |
|---|---|
| `bun run dev` | API (watch) + Vite (HMR) |
| `bun run build` | typecheck web + Vite build into `web/dist` |
| `bun run start` | production server (serves `web/dist`) |
| `bun run typecheck` | server + web `tsc` |
| `bun run lint` / `format` | Biome |
| `bun test` | server tests (scan, model, credit, HTTP) |
| `bun run verify` | all of the above, plus the build |

## Pages

| Route | Answers |
|---|---|
| `/` Overview | Is it moving? What needs me? Progress, usage, time. 4 summary cards, plus an Outcomes pack card when the run has an `OUTCOMES.md` |
| `/stages` | Phases → stages → artifacts, unit progress, stage × unit matrix |
| `/timeline` | Time buckets, gantt, rework, workers, unknown gaps |
| `/decisions` | Deferred decisions, owners, open questions |
| `/usage` | Kiro credit or Claude Code tokens, window 7d / 30d / all (`?cw=`) |
| `/sources` | Freshness of every input, read warnings |
| `/pick` | Workspace picker (discovery + folder browser + path). Cards for a few workspaces; above 6 it defaults to a one-row-each list with a name/path filter and shows the first 8 ("Show N more"). The Cards/List choice is kept per browser |
| `/view?rel=` | Read-only source of a record file (and `OUTCOMES.md`, see below) |

In **Workspaces found**, **Remove** hides an entry in this browser only; it never
deletes project files or changes the active workspace. Removed entries stay hidden
after reloads and scans; **Restore removed** brings them back. They can still be
opened through the folder browser or by path. Folder, root, breadcrumb and
hidden-folder navigation preserve the page's scroll position.

**Outcomes pack.** `OUTCOMES.md` (written by the `aidlc-outcomes-pack` skill at run
close) is read from the record first, then from the workspace root. A root copy is
flagged on the card: the next intent's run overwrites it, so keep a copy in
`<record>/OUTCOMES.md`. Only that exact file name may come from the root; everything
else stays inside the record jail.

**Question files.** An `[Answer]: A` line is a link definition to CommonMark and
would render as nothing; Preview shows it, boxed in green. When the answer names
option letters that all exist in the `A. … / B. …` block above it (`A`, `a,b`,
`A + C`, `X. Other: …`), or the exact text of a list item (`Looks correct`), those
options are marked green with a check. Free-text answers are shown but highlight
nothing.

Markdown files support Preview and Raw modes. Fenced `mermaid` blocks render as
diagrams in Preview, following the light/dark/system theme. Each diagram opens
fitted to the page width (never enlarged) and has Fit, zoom out/in (5–400%) and
100% controls; when zoomed, it scrolls inside its frame, including with the
keyboard. Invalid diagrams show an error and their source without hiding the rest
of the document. Raw mode and ordinary code blocks remain unchanged. Mermaid is
bundled locally, uses strict security, and displays generated SVG as inert images
rather than inserting it as page HTML. HTML images in labels are removed;
image-shaped nodes are refused before rendering, so workspace diagrams cannot use
them to fetch external resources.

**Notifications** (bell, top right):

- **Needs you** (gate, question, stuck, failed check, run complete): a toast and a
  `(N)` count in the tab title. While you are on another tab, the title also blinks
  `● <notice>` until you come back. You also get an OS notification when the tab is
  in the background, but only after you allow it in the bell and only on localhost
  or https; browsers don't offer it over plain http by IP.
- **Milestones** (stage, unit or phase completed; gate rejected): a toast, which
  you can switch off.

All of it is kept per browser. Rules are in [`DESIGN.md`](DESIGN.md#notifications).

## Language support

The interface ships in **English** and **Tiếng Việt**. Use `?lang=en` or `?lang=vi`
once and a cookie remembers the choice; the language menu in the header does the
same. Every string lives in a typed catalogue
(`web/src/i18n/catalog.ts`, `en.ts`, `vi.ts`), so a missing translation is a
typecheck failure rather than a blank label. Workspace text — headings, file names,
feedback — is always quoted verbatim and never translated.

A short Vietnamese overview is at the end of this file.

## Theme

Light, dark or follow-OS, stored per browser. The palette, spacing, motion and
component rules are in [`DESIGN.md`](DESIGN.md); read it before any UI change.

## Server options

`--root <dir>` · `--port <n>` (env `AIDLC_DASHBOARD_PORT`, default 4321) ·
`--host <ip>` · `--allow-host <ip>` · `--poll <ms>` · `--interval <ms>` ·
`--lang en|vi` · `--usage kiro|claude`. Run `bun run start -- --help` for details.

**No authentication.** The server binds loopback. `--host` / `--allow-host` expose
it to anyone who can reach that IP, including the folder picker.

## API

`GET /api/meta` · `/api/model?cw=` · `/api/browse?dir=&hidden=1` · `/api/workspaces` ·
`/api/summary?dir=` · `/api/view?rel=` · `/api/current` · `/api/trend?window=` ·
`/healthz` · `GET /select?dir=` (sets the active workspace) · `GET /open?rel=` (opens
the file in the OS editor) · `POST /api/refresh` (manual credit collection).

Errors arrive as `{ "error": { "code": … } }`. Every route checks the `Host` header
(DNS rebinding). `/select`, `/open` and `/api/refresh` also refuse cross-site
callers.

## Project layout

```
server/            Bun server: HTTP routes, workspace scan, model assembly, credit
  scan/            Audit, state, questions, outcomes, workspace discovery, file jail
  model/           Types, status derivation, freshness
  credit/          Kiro credit store and Claude Code transcript reader
  test/            bun:test suites (scan, model, credit, HTTP, notifications)
web/src/
  routes/          TanStack file routes (/, /stages, /timeline, …, /pick, /view)
  components/      Shared building blocks: page, status, charts, picker, UI kit
  features/        Page-specific code, one folder per page
  i18n/            Typed English and Vietnamese catalogues
  lib/             API client, theme, formatting, notifications
fixtures/reference/  Synthetic AI-DLC v2 run used by dev and tests
```

`server/` must stay free of DOM types. The client imports server **types** and pure
helpers through the `@server/*` alias; a server module that touches `node:*` is
never value-imported by the client.

## Security model

- Loopback bind by default; a `Host` check on every route (DNS rebinding) and a
  cross-site guard on `/select`, `/open` and `/api/refresh`.
- Artifact reads and OS-editor launches resolve inside the active record (or the one
  allowed `OUTCOMES.md` at the workspace root) and refuse anything that escapes it.
- The client never renders workspace text as markup; Markdown goes through an
  allowlist, and no `dangerouslySetInnerHTML`.
- The server has no authentication by design. Do not expose it beyond a network you
  trust; read [`SECURITY.md`](SECURITY.md) before reporting a vulnerability.

## Related projects

- [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) — the
  AI-DLC method this dashboard observes.
- [wowzoo/aidlc-dashboard](https://github.com/wowzoo/aidlc-dashboard) — the v1
  dashboard for AI-DLC v1 runs.

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md)
for the development setup, the design and copy rules, the gate every change must
pass, and the translation workflow. By taking part you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

If this dashboard is useful to you, a star helps other AI-DLC users find it, and the
badges above track releases, downloads and activity.

## License

[MIT](LICENSE) © 2026 Le Bao Duy

---

## Tiếng Việt

**AI-DLC Dashboard v2** là bảng điều khiển web chỉ đọc cho một run AI-DLC v2: trạng
thái, tiến độ, điểm đang chờ bạn xử lý, thời gian, quyết định còn treo và chi phí sử
dụng. Dashboard **không ghi gì vào workspace** — chỉ ghi `data/usage.db` và
`data/recent-workspaces.json` nằm ngoài workspace. Server mặc định chỉ nghe loopback
và **không có xác thực**.

Yêu cầu: [Bun](https://bun.sh) 1.4+ và một workspace AI-DLC **v2** (chứa `aidlc/` với
record của intent). Chỉ hỗ trợ v2; bản v1 dùng
[wowzoo/aidlc-dashboard](https://github.com/wowzoo/aidlc-dashboard).

```bash
bun install && (cd web && bun install)
bun run build
bun run start -- --root ~/duong/dan/workspace   # http://127.0.0.1:4321
```

Giao diện có **tiếng Anh** và **tiếng Việt**: dùng `?lang=vi` một lần, cookie sẽ ghi
nhớ lựa chọn (hoặc chọn ở menu ngôn ngữ trên header). Theme sáng/tối/theo hệ thống.
Đóng góp: xem [`CONTRIBUTING.md`](CONTRIBUTING.md). Giấy phép: [MIT](LICENSE).
