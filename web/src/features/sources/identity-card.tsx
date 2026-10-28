// What this read pointed at: the v1 header path line (root · space · harness) plus the
// record and state file, as plain mono text so a long path wraps instead of overflowing.

import { Section } from "@/components/page";
import { useI18n } from "@/i18n";
import type { RunIdentity } from "@server/model/types";
import type { IntentRow } from "@server/scan/intents";
import type { PlannedStage } from "@server/scan/plan";
import type { RuntimeGraph } from "@server/scan/runtime-graph";
import { FolderTreeIcon } from "lucide-react";

export function IdentityCard({
  id,
  runtime,
  plan,
  spaces,
  intents,
}: {
  id: RunIdentity;
  runtime?: RuntimeGraph;
  plan?: PlannedStage[];
  spaces?: string[];
  intents?: IntentRow[];
}) {
  const { s, c } = useI18n();
  const t = c.sourcesPage;
  const execute = plan?.filter((stage) => stage.action === "EXECUTE").length ?? 0;
  const skip = plan ? plan.length - execute : 0;
  const rows: [string, string, boolean][] = [
    [t.root, id.root, true],
    [t.space, id.space, true],
    [t.harness, id.harnessDir ?? s.page.harnessNotFound, id.harnessDir !== undefined],
    [t.record, id.record, true],
    [t.stateFile, id.stateRel, true],
    [
      t.execution,
      runtime ? t.runtimeMeta(runtime.stages.length, runtime.workflowId ?? "—") : t.runtimeMissing,
      runtime !== undefined,
    ],
    ...(plan ? [[t.plan, t.planSummary(execute, skip), true] as [string, string, boolean]] : []),
    ...(spaces ? [[t.spaces, spaces.join(" · "), true] as [string, string, boolean]] : []),
    ...(intents ? [[t.registry, String(intents.length), true] as [string, string, boolean]] : []),
  ];
  return (
    <Section title={t.identity} icon={<FolderTreeIcon />}>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        {rows.map(([label, value, found]) => (
          <div key={label} className="contents">
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</dt>
            <dd
              className={
                found
                  ? "min-w-0 break-all font-mono text-xs leading-5"
                  : "min-w-0 text-xs leading-5 text-muted-foreground"
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
