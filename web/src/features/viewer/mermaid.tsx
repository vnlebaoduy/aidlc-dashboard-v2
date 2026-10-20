import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useTheme } from "@/lib/theme";
import {
  LoaderCircleIcon,
  MaximizeIcon,
  TriangleAlertIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

// Mermaid has global configuration. Serialize initialization + rendering, not just
// render(), so simultaneous blocks and theme changes cannot borrow another theme.
let queue: Promise<void> = Promise.resolve();
let nextId = 0;

type Diagram = { source: string; dark: boolean; uri?: string; error?: string };

export function MermaidPreview({ source }: { source: string }) {
  const { c } = useI18n();
  const t = c.viewerPage;
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (cancelled) return;
      let host: HTMLDivElement | undefined;
      try {
        // Do not let a diagram's frontmatter/directives override site security
        // or enable HTML labels. SVG is displayed as an inert image, never HTML.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          secure: Object.keys(mermaid.mermaidAPI.defaultConfig),
          theme: dark ? "dark" : "default",
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          dompurifyConfig: { FORBID_TAGS: ["img", "image", "style"], FORBID_ATTR: ["style"] },
          fontFamily: "Arial, sans-serif",
          suppressErrorRendering: true,
        });
        // Image-shaped flowchart nodes bypass label sanitization and fetch while
        // measuring. Inspect parsed metadata before render (not source regexes).
        const parsed = await mermaid.mermaidAPI.getDiagramFromText(source);
        if ("getVertices" in parsed.db && typeof parsed.db.getVertices === "function") {
          const vertices: unknown = parsed.db.getVertices();
          if (
            vertices instanceof Map &&
            [...vertices.values()].some(
              (node: unknown) => node && typeof node === "object" && "img" in node && node.img,
            )
          ) {
            throw new Error("Image nodes are disabled in read-only diagram previews.");
          }
        }
        host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden";
        host.setAttribute("aria-hidden", "true");
        document.body.append(host);
        const { svg } = await mermaid.render(`mermaid-preview-${++nextId}`, source, host);
        if (!cancelled) {
          // Percent SVG dimensions otherwise become a tiny 300×150 image.
          const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          const root = doc.documentElement;
          const box = root
            .getAttribute("viewBox")
            ?.trim()
            .split(/[\s,]+/)
            .map(Number);
          const width = box?.[2];
          const height = box?.[3];
          if (width && height && width > 0 && height > 0) {
            root.setAttribute("width", String(width));
            root.setAttribute("height", String(height));
          }
          setDiagram({
            source,
            dark,
            uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setDiagram({
            source,
            dark,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        host?.remove();
      }
    };
    queue = queue.then(render, render);
    return () => {
      cancelled = true;
    };
  }, [source, dark]);

  const current = diagram?.source === source && diagram.dark === dark ? diagram : null;
  return (
    <div className="my-4 min-w-0 rounded-lg border bg-card p-4">
      {current?.uri ? (
        <DiagramViewport key={source} uri={current.uri} />
      ) : current?.error ? (
        <>
          <p role="alert" className="flex items-center gap-2 text-warning-foreground">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
            {t.mermaidError}
          </p>
          <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">{current.error}</pre>
          <pre className="mt-3 overflow-x-auto rounded-sm bg-muted/50 p-3 text-[13px] leading-6">
            <code>{source}</code>
          </pre>
        </>
      ) : (
        <output className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {t.mermaidLoading}
        </output>
      )}
    </div>
  );
}

/**
 * Fit = frame width (never upscaled); the frame then grows to the diagram's height so
 * there is no empty band. Manual zoom caps the frame height and scrolls inside it.
 * Zoom resizes the rendered SVG image; Mermaid is not rerun.
 */
function DiagramViewport({ uri }: { uri: string }) {
  const { c } = useI18n();
  const t = c.viewerPage;
  const frame = useRef<HTMLElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = naturalWidth && frameWidth ? Math.min(1, frameWidth / naturalWidth) : 1;
  const scale = zoom ?? fit;
  const ready = naturalWidth > 0 && frameWidth > 0;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={zoom === null ? "secondary" : "ghost"}
          aria-pressed={zoom === null}
          onClick={() => {
            setZoom(null);
            frame.current?.scrollTo(0, 0);
          }}
        >
          <MaximizeIcon aria-hidden />
          {t.mermaidFit}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.mermaidZoomOut}
          title={t.mermaidZoomOut}
          disabled={!ready || scale <= 0.05}
          onClick={() => setZoom(Math.max(0.05, scale / 1.25))}
        >
          <ZoomOutIcon aria-hidden />
        </Button>
        <span
          className="min-w-12 text-center text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.mermaidZoomIn}
          title={t.mermaidZoomIn}
          disabled={!ready || scale >= 4}
          onClick={() => setZoom(Math.min(4, scale * 1.25))}
        >
          <ZoomInIcon aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t.mermaidActualSize}
          title={t.mermaidActualSize}
          disabled={!ready}
          onClick={() => setZoom(1)}
        >
          100%
        </Button>
      </div>
      <section
        ref={frame}
        className={zoom === null ? "overflow-hidden" : "max-h-[80vh] overflow-auto"}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Zoomed diagrams must be keyboard-scrollable.
        tabIndex={0}
        aria-label={t.mermaidDiagram}
      >
        <div className="flex w-max min-w-full justify-center">
          <img
            src={uri}
            alt={t.mermaidDiagram}
            className="block h-auto max-w-none shrink-0"
            style={{ width: naturalWidth ? naturalWidth * scale : undefined }}
            onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
          />
        </div>
      </section>
    </>
  );
}
