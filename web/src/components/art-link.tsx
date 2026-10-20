import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { refusalText } from "@/i18n/warnings";
import { openInEditor } from "@/lib/api";
import { cn } from "@/lib/utils";
// Artifact links: open in the OS editor (via `/open`, page stays) or in the viewer.
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "opened" }
  | { kind: "failed"; why: string };

export function OpenInEditor({
  rel,
  className,
  label,
}: { rel: string; className?: string; label?: string }) {
  const { s } = useI18n();
  const [st, setSt] = useState<State>({ kind: "idle" });
  async function go() {
    if (st.kind === "busy") return;
    setSt({ kind: "busy" });
    const r = await openInEditor(rel);
    if (r.ok) {
      setSt({ kind: "opened" });
      setTimeout(() => setSt({ kind: "idle" }), 1200);
    } else if ("unreachable" in r) setSt({ kind: "failed", why: s.page.jsOpenFailedUnreachable });
    else
      setSt({
        kind: "failed",
        why: r.refusal
          ? refusalText(r.refusal, s)
          : s.page.jsOpenFailedStatus.replace("{status}", String(r.status)),
      });
  }
  const Icon =
    st.kind === "busy"
      ? LoaderCircleIcon
      : st.kind === "opened"
        ? CheckIcon
        : st.kind === "failed"
          ? TriangleAlertIcon
          : ExternalLinkIcon;
  const tip = st.kind === "failed" ? st.why : s.overview.openInEditor(rel);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={go}
          aria-busy={st.kind === "busy" || undefined}
          aria-label={label ?? tip}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            st.kind === "failed" && "text-danger-foreground",
            st.kind === "opened" && "text-success-foreground",
            className,
          )}
        >
          <Icon className={cn("size-3.5", st.kind === "busy" && "animate-spin")} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Link into the in-app source viewer. It carries the page it was clicked from (`from`,
 * path + query), so the viewer's Back returns there rather than to the overview, even
 * after a reload or when opened in a new tab.
 */
export function ViewLink({
  rel,
  children,
  className,
  title,
}: { rel: string; children?: React.ReactNode; className?: string; title?: string }) {
  const from = useRouterState({ select: (s) => s.location.href });
  return (
    <Link
      to="/view"
      search={{ rel, from: from.startsWith("/view") ? undefined : from }}
      title={title}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-brand-blue underline-offset-4 hover:underline",
        className,
      )}
    >
      {children ?? (
        <>
          <FileTextIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{rel.split("/").pop()}</span>
        </>
      )}
    </Link>
  );
}
