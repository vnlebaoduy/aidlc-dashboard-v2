import { ErrorState, PageSkeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileTree } from "@/features/viewer/file-tree";
import {
  ModeToggle,
  SourceBody,
  SourceMeta,
  SourceRefusal,
  type ViewMode,
  isMarkdown,
} from "@/features/viewer/source";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { ApiFailure, api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, FolderTreeIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/view")({
  // `mode` is in the URL so a shared link or a reload keeps Raw vs Preview.
  // `from` is the in-app page the viewer was opened from (path + query). Only a same-app
  // path is kept — never an absolute URL — so it cannot become an open redirect.
  validateSearch: (
    s: Record<string, unknown>,
  ): { rel: string; mode?: ViewMode; from?: string } => ({
    rel: typeof s.rel === "string" ? s.rel : "",
    mode: s.mode === "raw" || s.mode === "preview" ? s.mode : undefined,
    from:
      typeof s.from === "string" &&
      s.from.startsWith("/") &&
      !s.from.startsWith("//") &&
      !s.from.startsWith("/view")
        ? s.from
        : undefined,
  }),
  component: Page,
});

function Page() {
  const { s, c } = useI18n();
  const t = s.viewer;
  const { rel, mode: asked, from } = Route.useSearch();
  const [filesOpen, setFilesOpen] = useState(false);
  // Inside the `_app` layout, which renders only once the run model is loaded (and sends
  // a reader with no workspace to /pick), so the model is always here.
  const m = useRun().data!;
  const navigate = useNavigate({ from: "/view" });
  const md = isMarkdown(rel);
  // Markdown opens rendered; the reader can flip to the source and back.
  const mode: ViewMode = md ? (asked ?? "preview") : "raw";
  const view = useQuery({
    queryKey: ["view", rel],
    queryFn: () => api.view(rel),
    enabled: rel.length > 0,
    retry: false,
  });

  useEffect(() => {
    document.title = t.docTitle(rel);
  }, [t, rel]);

  // `rel` is record-relative POSIX; the heading names the file, the full path sits below it.
  const name = rel.split("/").pop() || rel;
  const r = view.data;

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block">
        {/* Sticky under the app header (h-16) with the page's own top padding. */}
        <div className="sticky top-24 flex max-h-[calc(100svh-7rem)] flex-col">
          <FileTree m={m} current={rel} from={from} />
        </div>
      </aside>
      <div className="min-w-0 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button variant="link" size="sm" asChild className="h-auto px-0">
              {/* Back to the page the file was opened from (Stages, Decisions …), not home. */}
              <a href={from ?? "/"}>
                <ArrowLeftIcon aria-hidden />
                {from ? c.viewerPage.back : t.back}
              </a>
            </Button>
            <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <FolderTreeIcon aria-hidden />
                  {c.viewerPage.showFiles}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(20rem,85vw)] flex-col gap-0 p-4 pt-12"
              >
                <SheetTitle className="sr-only">{c.viewerPage.files}</SheetTitle>
                <FileTree m={m} current={rel} from={from} onPick={() => setFilesOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
          <h1 className="break-all text-2xl font-semibold leading-8 tracking-tight">{name}</h1>
          {rel ? <p className="break-all font-mono text-xs text-muted-foreground">{rel}</p> : null}
          {r?.ok ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SourceMeta src={r.source} />
              {md && r.source.text.length > 0 ? (
                <ModeToggle
                  mode={mode}
                  onChange={(m) =>
                    void navigate({ search: (p) => ({ ...p, mode: m }), replace: true })
                  }
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {!rel ? (
          <ErrorState error={new ApiFailure(400, { code: "missing-param", param: "rel" })} />
        ) : r ? (
          r.ok ? (
            <SourceBody src={r.source} mode={mode} />
          ) : (
            <SourceRefusal result={r} />
          )
        ) : view.isError ? (
          <ErrorState
            error={view.error}
            action={
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => view.refetch()}>
                  {c.retry}
                </Button>
              </div>
            }
          />
        ) : (
          <PageSkeleton />
        )}
      </div>
    </div>
  );
}
