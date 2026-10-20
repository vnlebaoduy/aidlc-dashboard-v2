// Typed client for the Bun server's JSON API (server/server.ts). Every failure arrives
// as `{ error: ApiError }`; `ApiFailure` carries it so a page can word it in the
// reader's language (`apiErrorText`).

import type { Strings } from "@/i18n/catalog";
import type { ApiError } from "@server/api-types";
import type { DashboardModel, Locale } from "@server/model/types";
import type { BrowseResult } from "@server/scan/browse";
import type { ExplorerModel } from "@server/scan/explorer";
import type { OpenRefusal } from "@server/scan/open-file";
import type { WorkspaceSummary } from "@server/scan/summary";
import type { ViewResult } from "@server/scan/view-file";
import type { WorkspaceDiscovery, WorkspaceMatch } from "@server/scan/workspaces";

export type { ApiError, DashboardModel };

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError | undefined,
  ) {
    super(error ? error.code : `HTTP ${status}`);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) {
    let error: ApiError | undefined;
    try {
      error = ((await res.json()) as { error?: ApiError }).error;
    } catch {
      error = undefined;
    }
    throw new ApiFailure(res.status, error);
  }
  return (await res.json()) as T;
}

export interface Meta {
  version: string;
  pollMs: number;
  locale: Locale;
  activeRoot: string | null;
}

export type UsageWindow = "7d" | "30d" | "all";

export const api = {
  meta: () => getJson<Meta>("/api/meta"),
  model: (cw: UsageWindow) => getJson<DashboardModel>(`/api/model?cw=${cw}`),
  browse: (dir: string | undefined, hidden: boolean) => {
    const q = new URLSearchParams();
    if (dir) q.set("dir", dir);
    if (hidden) q.set("hidden", "1");
    return getJson<{ listing: BrowseResult; explorer: ExplorerModel; activeRoot: string | null }>(
      `/api/browse?${q}`,
    );
  },
  workspaces: () =>
    getJson<
      WorkspaceDiscovery & {
        workspaces: WorkspaceMatch[];
        active: { path: string; name: string } | null;
      }
    >("/api/workspaces"),
  summary: (dir: string) =>
    getJson<WorkspaceSummary>(`/api/summary?dir=${encodeURIComponent(dir)}`),
  view: async (rel: string): Promise<ViewResult> => {
    const res = await fetch(`/api/view?rel=${encodeURIComponent(rel)}`, { cache: "no-store" });
    const body = (await res.json()) as ViewResult | { error: ApiError };
    if ("error" in body) throw new ApiFailure(res.status, body.error);
    return body;
  },
  /** Manual credit re-collection. 503 (no credit runtime) is not a failure of the reload. */
  refresh: async (): Promise<void> => {
    const res = await fetch("/api/refresh", { method: "POST" });
    if (!res.ok && res.status !== 503) throw new ApiFailure(res.status, undefined);
  },
};

export type OpenOutcome =
  | { ok: true }
  | { ok: false; refusal?: OpenRefusal; status: number }
  | { ok: false; unreachable: true };

/** Ask the server to open an artifact in the OS editor. 204 = opened. */
export async function openInEditor(rel: string): Promise<OpenOutcome> {
  try {
    const res = await fetch(`/open?rel=${encodeURIComponent(rel)}`, { cache: "no-store" });
    if (res.ok) return { ok: true };
    let refusal: OpenRefusal | undefined;
    try {
      refusal = ((await res.json()) as { refusal?: OpenRefusal }).refusal;
    } catch {
      refusal = undefined;
    }
    return { ok: false, refusal, status: res.status };
  } catch {
    return { ok: false, unreachable: true };
  }
}

/** Select a workspace (server validates) and land on the dashboard. */
export function selectHref(dir: string): string {
  return `/select?dir=${encodeURIComponent(dir)}`;
}

/** The reader's-language sentence for an API failure. */
export function apiErrorText(err: unknown, s: Strings): string {
  if (!(err instanceof ApiFailure) || !err.error) {
    return s.errorPage.readFailed(err instanceof Error ? err.message : String(err));
  }
  const e = err.error;
  switch (e.code) {
    case "no-workspace":
      return s.errorPage.noWorkspaceSelected;
    case "no-run":
      return e.kind === "ambiguous" ? s.cli.intentAmbiguous(e.root) : s.cli.noWorkflow(e.root);
    case "not-a-workspace":
      return s.errorPage.notAWorkspace(e.dir);
    case "missing-param":
      return s.cli.needValue(e.param);
    case "credit-unavailable":
      return s.errorPage.readFailed("credit runtime unavailable");
    case "not-built":
      return s.errorPage.readFailed("web/dist missing — run `bun run build`");
    case "read-failed":
      return s.errorPage.readFailed(e.message);
  }
}
