// Wire types shared with the web client. Type-only on purpose: the client imports this
// file, and it must not pull server runtime (node:*, sqlite, child_process) into its graph.

/**
 * Every `/api/*` failure has this shape, so the client can say it in the reader's
 * language from the FACTS rather than from server-side copy.
 */
export type ApiError =
  | { code: "no-workspace" }
  | { code: "no-run"; kind: "none" | "ambiguous"; root: string }
  | { code: "not-a-workspace"; dir: string }
  | { code: "missing-param"; param: string }
  | { code: "credit-unavailable" }
  | { code: "not-built" }
  | { code: "read-failed"; message: string; root?: string };
