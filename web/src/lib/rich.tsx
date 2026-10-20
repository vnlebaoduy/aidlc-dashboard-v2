// Safe renderer for catalogue entries that carry inline markup.
//
// Some messages in i18n/{en,vi}.ts contain `<b>`, `<code>`, `<i class="lg x">`,
// `<span class="mute">` or `<a href="/…">`, and some are called with workspace-derived
// arguments the CALLER escapes with `esc()`. Only an allowlist of tags becomes React
// elements; anything else stays text. Entities are decoded so an escaped argument reads
// as written. Never `dangerouslySetInnerHTML`.

import { Fragment, type ReactNode } from "react";
import { cn } from "./utils";

/** Escape a workspace-derived argument before passing it into a markup-bearing message. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ENTITY: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": "\u00a0",
};

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITY[m] ?? m);
}

/** Legend swatches used by `timeline.ganttLegend` (`<i class="lg wait">`). */
export const LEGEND: Record<string, string> = {
  observed: "bg-chart-1",
  conv: "bg-chart-2",
  wait: "bg-chart-3",
  parked: "bg-chart-5",
  unknown: "bg-muted-foreground/20",
};

type Tag = "b" | "strong" | "code" | "i" | "em" | "span" | "a" | "br";
const ALLOWED: Record<string, Tag> = {
  b: "b",
  strong: "strong",
  code: "code",
  i: "i",
  em: "em",
  span: "span",
  a: "a",
  br: "br",
};

interface Node {
  tag?: Tag;
  attrs: Record<string, string>;
  children: (Node | string)[];
}

function attrsOf(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1]!] = decode(m[2]!);
  return out;
}

function parse(src: string): Node {
  const root: Node = { attrs: {}, children: [] };
  const stack: Node[] = [root];
  const re = /<(\/?)([a-zA-Z]+)([^>]*)>/g;
  let last = 0;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    const top = stack[stack.length - 1]!;
    const tag = ALLOWED[m[2]!.toLowerCase()];
    if (!tag) continue;
    if (m.index > last) top.children.push(decode(src.slice(last, m.index)));
    last = re.lastIndex;
    if (m[1]) {
      if (stack.length > 1 && top.tag === tag) stack.pop();
      continue;
    }
    const node: Node = { tag, attrs: attrsOf(m[3] ?? ""), children: [] };
    top.children.push(node);
    if (tag !== "br" && !m[3]?.trim().endsWith("/")) stack.push(node);
  }
  if (last < src.length) stack[stack.length - 1]!.children.push(decode(src.slice(last)));
  return root;
}

function safeHref(href: string | undefined): string | undefined {
  return href?.startsWith("/") && !href.startsWith("//") ? href : undefined;
}

function render(n: Node | string, key: number): ReactNode {
  if (typeof n === "string") return n;
  const kids = n.children.map(render);
  const cls = n.attrs.class ?? "";
  switch (n.tag) {
    case "b":
    case "strong":
      return (
        <strong key={key} className="font-semibold text-foreground">
          {kids}
        </strong>
      );
    case "code":
      return (
        <code key={key} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {kids}
        </code>
      );
    case "i":
    case "em": {
      if (cls.split(/\s+/).includes("lg")) {
        const lg = cls.split(/\s+/).find((c) => LEGEND[c]);
        return (
          <span
            key={key}
            aria-hidden="true"
            className={cn("mx-0.5 inline-block size-2.5 rounded-sm align-middle", lg && LEGEND[lg])}
          />
        );
      }
      return <em key={key}>{kids}</em>;
    }
    case "span":
      return (
        <span key={key} className={cls.includes("mute") ? "text-muted-foreground" : undefined}>
          {kids}
        </span>
      );
    case "a": {
      const href = safeHref(n.attrs.href);
      return href ? (
        <a
          key={key}
          href={href}
          className="font-medium text-brand-blue underline-offset-4 hover:underline"
        >
          {kids}
        </a>
      ) : (
        <Fragment key={key}>{kids}</Fragment>
      );
    }
    case "br":
      return <br key={key} />;
    default:
      return <Fragment key={key}>{kids}</Fragment>;
  }
}

/** Render a catalogue string that may contain allowlisted inline markup. */
export function Rich({ html, className }: { html: string; className?: string }) {
  return <span className={className}>{parse(html).children.map(render)}</span>;
}
