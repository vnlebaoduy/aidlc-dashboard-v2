import { PageHeader } from "@/components/page";
import { ledgerState, openDiary } from "@/features/decisions/faces";
import { LedgerSummary } from "@/features/decisions/ledger";
import { DecisionLists } from "@/features/decisions/lists";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/decisions")({ component: Page });

function Page() {
  const { c } = useI18n();
  const m = useRun().data!;
  const state = ledgerState(m.deferrals);
  const diary = openDiary(m.diaries.records);
  return (
    <div className="space-y-6">
      <PageHeader title={c.nav.decisions} lead={c.lead.decisions} />
      <LedgerSummary m={m} state={state} diary={diary} />
      <DecisionLists m={m} diary={diary} withItems={state === "items"} />
    </div>
  );
}
