// One record artifact's source. Workspace text is hostile input: Raw puts it in a
// <pre> as a React text node; Preview (Markdown files only) goes through
// `MarkdownPreview`, which builds elements from the markdown AST and never renders raw
// HTML. Any other file type (an .html shows its <script> as text) is Raw only.

import { OpenInEditor } from "@/components/art-link";
import { Empty } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n";
import { refusalText } from "@/i18n/warnings";
import { fmtBytes } from "@/lib/format";
import type { ArtifactSource, ViewResult } from "@server/scan/view-file";
import { CodeXmlIcon, EyeIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import { MarkdownPreview } from "./markdown";

export function SourceMeta({ src }: { src: ArtifactSource }) {
  const { s } = useI18n();
  const t = s.viewer;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <FileTextIcon className="size-4" aria-hidden />
      <span className="tabular">{t.size(fmtBytes(src.sizeBytes))}</span>
      <OpenInEditor rel={src.rel} label={t.openInEditor} />
    </div>
  );
}

export type ViewMode = "preview" | "raw";

/** `.md` / `.markdown` get a Preview; everything else is Raw only. */
export function isMarkdown(rel: string): boolean {
  return /\.(md|markdown)$/i.test(rel);
}

export function ModeToggle({
  mode,
  onChange,
}: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { c } = useI18n();
  const items: { v: ViewMode; label: string; Icon: typeof EyeIcon }[] = [
    { v: "preview", label: c.viewerPage.preview, Icon: EyeIcon },
    { v: "raw", label: c.viewerPage.raw, Icon: CodeXmlIcon },
  ];
  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(v) => v && onChange(v as ViewMode)}
      aria-label={c.viewerPage.mode}
      className="rounded-full border bg-card p-1"
    >
      {items.map(({ v, label, Icon }) => (
        <ToggleGroupItem
          key={v}
          value={v}
          aria-label={label}
          className="h-8 gap-1.5 rounded-full! px-3.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Icon aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function SourceBody({ src, mode }: { src: ArtifactSource; mode: ViewMode }) {
  const { s } = useI18n();
  const t = s.viewer;
  const preview = mode === "preview" && isMarkdown(src.rel);
  return (
    <>
      {src.truncated ? (
        <Alert className="border-warning/40 bg-warning/5">
          <TriangleAlertIcon className="text-warning-foreground" aria-hidden />
          <AlertDescription className="text-foreground/80">
            {t.truncated(fmtBytes(src.shownBytes), fmtBytes(src.sizeBytes))}
          </AlertDescription>
        </Alert>
      ) : null}
      {src.text.length > 0 ? (
        <Card className="py-0">
          {preview ? (
            <div className="px-4 py-5 sm:px-8 sm:py-6">
              <MarkdownPreview text={src.text} />
            </div>
          ) : (
            // pre-wrap, not a scrollbar: question files hold long prose lines, and a
            // horizontal scroll would hide the end of exactly the sentence being read.
            <pre className="wrap-anywhere whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-6 sm:px-5 sm:text-[13px]">
              {src.text}
            </pre>
          )}
        </Card>
      ) : (
        <Empty>{t.empty}</Empty>
      )}
    </>
  );
}

/** The jail or the read said no. The HTTP status rides along so 404 and 403 stay distinct. */
export function SourceRefusal({ result }: { result: Extract<ViewResult, { ok: false }> }) {
  const { s } = useI18n();
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {s.viewer.refusalHeading}
        <Badge variant="danger" className="font-mono tabular">
          {result.status}
        </Badge>
      </AlertTitle>
      <AlertDescription>{refusalText(result.refusal, s)}</AlertDescription>
    </Alert>
  );
}
