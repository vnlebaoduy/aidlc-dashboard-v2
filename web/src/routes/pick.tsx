import { ErrorState, Note, PageHeader, PageSkeleton } from "@/components/page";
import { StandaloneFrame } from "@/components/standalone-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FolderExplorer } from "@/features/picker/explorer";
import { OpenByPath } from "@/features/picker/open-by-path";
import { FoundWorkspaces } from "@/features/picker/workspaces";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { Rich, esc } from "@/lib/rich";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

interface PickSearch {
  dir?: string;
  /** `?hidden=1` from v1-style links and server redirects, `true` from our own links. */
  hidden?: boolean;
  /** Set by the server's `/select` redirect when the typed path holds no `aidlc/`. */
  error?: string;
}

export const Route = createFileRoute("/pick")({
  validateSearch: (q: Record<string, unknown>): PickSearch => ({
    // The router JSON-parses query values, so a folder named "2024" arrives as a number.
    dir:
      typeof q.dir === "string" || typeof q.dir === "number"
        ? String(q.dir) || undefined
        : undefined,
    hidden: q.hidden === true || q.hidden === 1 || q.hidden === "1" ? true : undefined,
    error: typeof q.error === "string" && q.error ? q.error : undefined,
  }),
  component: Page,
});

function Page() {
  const { s, c } = useI18n();
  const t = s.picker;
  const { dir, hidden = false, error } = Route.useSearch();
  const browse = useQuery({
    queryKey: ["browse", dir ?? "", hidden],
    queryFn: () => api.browse(dir, hidden),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    document.title = t.docTitle;
  }, [t.docTitle]);

  const b = browse.data;
  const failure = b?.listing.browseFailure;
  return (
    <StandaloneFrame>
      <PageHeader title={t.heading} lead={c.lead.workspaces} />

      {error === "not-a-workspace" ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription className="wrap-anywhere">
            {s.errorPage.notAWorkspace(dir ?? s.errorPage.noSelection)}
          </AlertDescription>
        </Alert>
      ) : null}
      {failure || b?.listing.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription className="wrap-anywhere">
            {failure
              ? s.explorer.browseFailed(failure.dir, failure.message)
              : s.errorPage.readFailed(b?.listing.error ?? "")}
          </AlertDescription>
        </Alert>
      ) : null}

      <FoundWorkspaces />

      {b ? (
        <>
          <FolderExplorer listing={b.listing} explorer={b.explorer} hidden={hidden} />
          <OpenByPath prefill={b.listing.isWorkspace ? b.listing.dir : ""} />
          {b.activeRoot ? (
            <Note className="wrap-anywhere">
              <Rich html={t.footer(esc(b.activeRoot))} />
            </Note>
          ) : null}
        </>
      ) : browse.isError ? (
        <ErrorState
          error={browse.error}
          action={
            <Button size="sm" variant="outline" className="mt-3" onClick={() => browse.refetch()}>
              {c.retry}
            </Button>
          }
        />
      ) : (
        <PageSkeleton />
      )}
    </StandaloneFrame>
  );
}
