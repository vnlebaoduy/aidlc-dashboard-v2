// Markdown preview for record artifacts (.md).
//
// Workspace text is hostile input. react-markdown builds React elements from the
// markdown AST and does NOT render raw HTML (no rehype-raw), so an `<script>` or
// `<img onerror>` inside a file shows as text. Links are limited to http(s) / mailto /
// in-page anchors and open in a new tab; images are not loaded (a record file must not
// make the browser fetch anything — the CSP would block it anyway), their alt text shows.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import Markdown, { type Components, defaultUrlTransform } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { remarkAnswers } from "./answers";
import { MermaidPreview } from "./mermaid";

function safeUrl(url: string): string {
  const u = defaultUrlTransform(url);
  return /^(https?:|mailto:|#)/i.test(u) ? u : "";
}

const H = "scroll-mt-20 font-semibold tracking-tight text-foreground";

const COMPONENTS: Components = {
  h1: ({ children }) => <h1 className={cn(H, "mt-2 mb-4 border-b pb-2 text-2xl")}>{children}</h1>,
  h2: ({ children }) => <h2 className={cn(H, "mt-8 mb-3 border-b pb-1.5 text-xl")}>{children}</h2>,
  h3: ({ children }) => <h3 className={cn(H, "mt-6 mb-2 text-base")}>{children}</h3>,
  h4: ({ children }) => <h4 className={cn(H, "mt-4 mb-2 text-sm")}>{children}</h4>,
  h5: ({ children }) => <h5 className={cn(H, "mt-4 mb-2 text-sm")}>{children}</h5>,
  h6: ({ children }) => (
    <h6 className={cn(H, "mt-4 mb-2 text-sm text-muted-foreground")}>{children}</h6>
  ),
  p: ({ children, node }) =>
    node?.properties.dataAnswer ? (
      <p className="my-3 rounded-sm border border-success/40 bg-success/10 px-3 py-1.5 leading-7 font-medium text-foreground">
        {children}
      </p>
    ) : (
      <p className="my-3 leading-7">{children}</p>
    ),
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target={href.startsWith("#") ? undefined : "_blank"}
        rel="noreferrer noopener"
        className="font-medium text-brand-blue underline-offset-4 hover:underline"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "my-3 space-y-1 pl-6",
        className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc",
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children, node }) =>
    node?.properties.dataChoice === "selected" ? (
      <li className="-ml-1 rounded-sm bg-success/10 px-1 leading-7 font-medium text-success-foreground marker:text-success-foreground">
        <CheckIcon className="mr-1 inline size-4 -translate-y-px" aria-hidden />
        {children}
      </li>
    ) : (
      <li className="leading-7 marker:text-muted-foreground">{children}</li>
    ),
  // A drawn box, not a disabled <input>: browsers grey a disabled checkbox until a
  // ticked item reads as unticked. The state is still announced to screen readers.
  input: ({ checked }) => (
    <span
      role="img"
      aria-label={checked ? "done" : "open"}
      className={cn(
        "mr-2 inline-flex size-4 -translate-y-px items-center justify-center rounded-sm border align-middle",
        checked ? "border-success bg-success text-white" : "border-muted-foreground/50 bg-card",
      )}
    >
      {checked ? <CheckIcon className="size-3" strokeWidth={3} aria-hidden /> : null}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary bg-accent/40 py-1 pr-3 pl-4 text-foreground/80">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  // `answers.ts` wraps each option line of an answered question in a span; the chosen
  // one is green with a check (icon + colour, never colour alone).
  span: ({ children, node }) => {
    const choice = node?.properties.dataChoice;
    if (choice === "selected") {
      return (
        <span className="-mx-1 flex items-start gap-1 rounded-sm bg-success/10 px-1 font-medium text-success-foreground">
          <CheckIcon className="mt-1.5 size-4 shrink-0" aria-hidden />
          <span>{children}</span>
        </span>
      );
    }
    return choice === "option" ? (
      <span className="block">{children}</span>
    ) : (
      <span>{children}</span>
    );
  },
  code: ({ className, children }) =>
    // Fenced blocks get a `language-*` class (or a newline); everything else is inline.
    className || String(children).includes("\n") ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
    ),
  pre: ({ children, node }) => {
    const code = node?.children[0];
    if (
      code?.type === "element" &&
      code.tagName === "code" &&
      Array.isArray(code.properties.className) &&
      code.properties.className.includes("language-mermaid")
    ) {
      return (
        <MermaidPreview
          source={code.children.map((child) => (child.type === "text" ? child.value : "")).join("")}
        />
      );
    }
    return (
      <pre className="my-4 overflow-x-auto rounded-lg border bg-muted/50 px-4 py-3 text-[13px] leading-6">
        {children}
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-hidden rounded-lg border">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader className="bg-muted/50">{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children, style }) => (
    <TableHead className="h-9 min-w-24 whitespace-normal wrap-normal text-foreground" style={style}>
      {children}
    </TableHead>
  ),
  td: ({ children, style }) => (
    <TableCell className="min-w-24 whitespace-normal wrap-normal align-top" style={style}>
      {children}
    </TableCell>
  ),
  img: ({ alt }) => (alt ? <span className="text-muted-foreground italic">[{alt}]</span> : null),
};

/**
 * `remark-breaks`: a single newline is a line break, not a space. CommonMark joins
 * consecutive lines into one paragraph, but AI-DLC files lay out answer options one per
 * line (`A. …` / `B. …` / `X. Other` — letters are not list markers), and the preview
 * ran them together into one sentence.
 */
const REMARK = [remarkGfm, remarkBreaks, remarkAnswers];

export function MarkdownPreview({ text }: { text: string }): ReactNode {
  return (
    <div className="wrap-anywhere text-sm text-foreground/90 sm:text-[15px]">
      <Markdown remarkPlugins={REMARK} components={COMPONENTS} urlTransform={safeUrl} skipHtml>
        {text}
      </Markdown>
    </div>
  );
}
