import { ViewLink } from "@/components/art-link";
import { Empty, PageHeader, Section } from "@/components/page";
import { IdentityCard } from "@/features/sources/identity-card";
import { SourcesTable } from "@/features/sources/sources-table";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { warningTextIn } from "@/i18n/warnings";
import { shortTs } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  LibraryIcon,
  TriangleAlertIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/sources")({ component: Page });

function Page() {
  const { s, c } = useI18n();
  const m = useRun().data!;
  return (
    <div className="space-y-6">
      <PageHeader title={c.nav.sources} lead={c.lead.sources} />

      {m.warnings.length > 0 ? (
        <Section
          title={s.page.warningsHeading}
          icon={<TriangleAlertIcon className="text-warning-foreground" />}
          className="border-warning/40"
        >
          <ul className="space-y-2">
            {m.warnings.map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: warnings are a per-read list, never reordered
              <li key={i} className="flex gap-2 text-sm">
                <TriangleAlertIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-warning-foreground"
                />
                <span className="min-w-0 break-words">{warningTextIn(w, s)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Empty className="flex items-center justify-center gap-2 py-4">
          <CircleCheckIcon aria-hidden className="size-4 text-success-foreground" />
          {c.sourcesPage.noWarnings}
        </Empty>
      )}

      <Section title={c.sourcesPage.freshness} icon={<DatabaseIcon />}>
        <SourcesTable m={m} />
      </Section>

      {m.knowledge ? (
        <Section title={c.sourcesPage.knowledge} icon={<LibraryIcon />}>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
              {c.sourcesPage.knowledgeDocuments}
            </dt>
            <dd className="tabular">{m.knowledge.documentFiles}</dd>
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
              {c.sourcesPage.knowledgeIndexed}
            </dt>
            <dd className="tabular">{m.knowledge.indexedDocuments ?? "—"}</dd>
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
              {c.sourcesPage.knowledgeStates}
            </dt>
            <dd className="break-words">
              {m.knowledge.states && m.knowledge.states.length > 0
                ? m.knowledge.states.map((state) => `${state.state} ${state.count}`).join(" · ")
                : "—"}
            </dd>
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
              {c.sourcesPage.knowledgeRules}
            </dt>
            <dd className="break-words">
              {m.knowledge.memoryFiles.length > 0 ? m.knowledge.memoryFiles.join(", ") : "—"}
              {m.knowledge.phaseRules > 0 ? ` · phases ${m.knowledge.phaseRules}` : ""}
            </dd>
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
              {c.sourcesPage.knowledgeCodekb}
            </dt>
            <dd className="break-words">
              {m.knowledge.codekbRepos.length > 0 ? m.knowledge.codekbRepos.join(", ") : "—"}
            </dd>
          </dl>
        </Section>
      ) : null}

      <Section title={c.sourcesPage.phaseChecks} icon={<ClipboardCheckIcon />}>
        {m.phaseChecks && m.phaseChecks.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {m.phaseChecks.map((check) => (
              <li key={check.rel} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium">{check.phase}</span>
                <ViewLink rel={check.rel} title={check.rel} className="inline">
                  {check.rel.split("/").pop() ?? check.rel}
                </ViewLink>
                {check.updatedAt ? (
                  <span className="text-xs text-muted-foreground">{shortTs(check.updatedAt)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="py-4">{c.sourcesPage.phaseCheckEmpty}</Empty>
        )}
      </Section>

      {m.reviews ? (
        <Section title={c.sourcesPage.reviews} icon={<ClipboardCheckIcon />}>
          <ul className="space-y-2 text-sm">
            {m.reviews.map((review) => (
              <li key={review.rel} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium">
                  {review.unit ? `${review.unit} · ` : ""}
                  {review.stage}
                </span>
                <span className="text-muted-foreground tabular">#{review.number}</span>
                {review.verdict ? <span className="font-medium">{review.verdict}</span> : null}
                {review.findings !== undefined && review.findings > 0 ? (
                  <span className="text-muted-foreground">
                    {c.sourcesPage.reviewFindings(review.findings)}
                  </span>
                ) : null}
                <ViewLink rel={review.rel} title={review.rel} className="inline">
                  {review.rel.split("/").pop() ?? review.rel}
                </ViewLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <IdentityCard
        id={m.identity}
        runtime={m.runtime}
        plan={m.plan}
        spaces={m.spaces}
        intents={m.intents}
        plugins={m.plugins}
      />
    </div>
  );
}
