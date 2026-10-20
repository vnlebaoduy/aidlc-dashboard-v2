import { PageHeader } from "@/components/page";
import { CreditView } from "@/features/usage/credit-view";
import { TokenView } from "@/features/usage/token-view";
import { WindowToggle } from "@/features/usage/window-toggle";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/usage")({ component: Page });

function Page() {
  const { s, c } = useI18n();
  const m = useRun().data!;
  const usage = m.usage;
  return (
    <div className="space-y-6">
      <PageHeader
        title={c.nav.usage}
        lead={c.lead.usage}
        actions={
          <WindowToggle
            label={usage.kind === "claude" ? s.usage.tokenToggleLabel : s.usage.trendToggleLabel}
          />
        }
      />
      {usage.kind === "claude" ? (
        <TokenView tokens={usage.tokens} />
      ) : (
        <CreditView credit={usage.credit} />
      )}
    </div>
  );
}
