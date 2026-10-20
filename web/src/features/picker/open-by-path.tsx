// "Open by path": a plain GET form to /select, which the server validates. Prefilled only
// when the folder being browsed is itself a workspace; otherwise empty, never a guess.

import { Section } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { Rich } from "@/lib/rich";
import { TextCursorInputIcon } from "lucide-react";
import { useId } from "react";

export function OpenByPath({ prefill }: { prefill: string }) {
  const { s } = useI18n();
  const t = s.picker;
  const id = useId();
  return (
    <Section id="manual" title={t.manualHeading} icon={<TextCursorInputIcon />}>
      <form action="/select" method="get" className="space-y-2">
        {/* A real label, not a placeholder: a placeholder vanishes the moment typing starts. */}
        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
          {t.manualLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            key={prefill}
            id={id}
            name="dir"
            defaultValue={prefill}
            placeholder="/Users/me/Development/project"
            autoComplete="off"
            spellCheck={false}
            required
            className="rounded-sm font-mono"
          />
          <Button type="submit" variant="action" className="shrink-0">
            {t.manualButton}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          <Rich html={t.manualNote} />
        </p>
      </form>
    </Section>
  );
}
