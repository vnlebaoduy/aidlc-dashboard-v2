// The detail under the ledger summary: one pill tab per list, most urgent first. Passed
// and current always exist (an empty one says "None."); every other tab exists only when
// it has something, so no toggle costs a click and returns nothing.

import { Note } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { Rich } from "@/lib/rich";
import type { DashboardModel } from "@server/model/types";
import type { DeferralItem, OwnerStatus } from "@server/scan/deferrals";
import type { ReactNode } from "react";
import { type OpenDiary, OwnerBadge } from "./faces";
import { AssumptionGroupRow, DiaryRow, ItemRow, RowList } from "./items";

interface Tab {
  value: string;
  label: string;
  count: number;
  body: ReactNode;
}

export function DecisionLists({
  m,
  diary,
  withItems,
}: {
  m: DashboardModel;
  diary: OpenDiary;
  withItems: boolean;
}) {
  const { s, c } = useI18n();
  const t = s.deferrals;
  const d = m.deferrals;
  const tabs = c.decisionsPage.tabs;
  const now = Date.parse(m.generatedAt);

  const byStatus = (st: OwnerStatus) => d.items.filter((i) => i.ownerStatus === st);
  const passed = byStatus("passed");
  const current = byStatus("current");
  const ahead = byStatus("ahead");
  const rest = d.items.filter(
    (i) => i.ownerStatus !== "passed" && i.ownerStatus !== "current" && i.ownerStatus !== "ahead",
  );
  const owned = d.byOwner.filter((o) => o.stage !== undefined).length;

  const items = (list: DeferralItem[], moreKey: string) => (
    <RowList
      rows={list}
      moreKey={moreKey}
      render={(it, i) => <ItemRow key={`${it.rel}-${i}`} it={it} />}
    />
  );

  const all: (Tab | false)[] = [
    withItems && {
      value: "passed",
      label: tabs.passed,
      count: passed.length,
      body: (
        <>
          <Heading>{t.headingPassed(passed.length)}</Heading>
          {items(passed, t.faces.passed.label)}
        </>
      ),
    },
    withItems && {
      value: "current",
      label: tabs.current,
      count: current.length,
      body: (
        <>
          <Heading>{t.headingCurrent(current.length)}</Heading>
          {items(current, t.faces.current.label)}
        </>
      ),
    },
    ahead.length > 0 && {
      value: "ahead",
      label: tabs.ahead,
      count: ahead.length,
      body: (
        <>
          <Heading>{t.summaryAhead(ahead.length)}</Heading>
          {items(ahead, t.faces.ahead.label)}
        </>
      ),
    },
    rest.length > 0 && {
      value: "rest",
      label: tabs.rest,
      count: rest.length,
      body: (
        <>
          <Heading>{t.summaryRest(rest.length)}</Heading>
          {items(rest, tabs.rest)}
        </>
      ),
    },
    d.assumptionGroups.length > 0 && {
      value: "assumptions",
      label: tabs.assumptions,
      count: d.assumptionGroups.length,
      body: (
        <>
          <Heading>{t.assumptionSummary(d.assumptionGroups.length, d.assumptions.length)}</Heading>
          <Note>
            <Rich html={t.assumptionNote} />
          </Note>
          <RowList
            rows={d.assumptionGroups}
            moreKey={t.assumptionPill}
            render={(g, i) => <AssumptionGroupRow key={`${g.members[0]?.rel}-${i}`} g={g} />}
          />
        </>
      ),
    },
    diary.open.length > 0 && {
      value: "questions",
      label: tabs.questions,
      count: diary.open.length,
      body: (
        <>
          <Heading>{t.diarySummary(diary.open.length)}</Heading>
          <Note>
            <Rich html={t.diaryNote(diary.resolved)} />
          </Note>
          <RowList
            rows={diary.open}
            moreKey={tabs.questions}
            render={(r, i) => <DiaryRow key={`${r.rel}-${i}`} r={r} now={now} />}
          />
        </>
      ),
    },
    // Only when some item names a stage: an all-bucket table would repeat the ledger.
    withItems &&
      owned > 0 && {
        value: "owners",
        label: tabs.owners,
        count: owned,
        body: (
          <>
            <Heading>{t.ownerRollup(owned)}</Heading>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colOwner}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead className="text-right">{t.colCount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.byOwner.map((o) => (
                  <TableRow key={`${o.status}-${o.stage ?? ""}`}>
                    <TableCell className="font-mono text-xs">
                      {o.stage ?? t.faces[o.status].label}
                    </TableCell>
                    <TableCell>
                      <OwnerBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right tabular">{o.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ),
      },
  ];
  const shown = all.filter((x): x is Tab => x !== false);
  if (shown.length === 0) return null;
  const first = shown.find((x) => x.count > 0) ?? shown[0]!;

  return (
    <Tabs defaultValue={first.value} className="gap-4">
      <TabsList>
        {shown.map((x) => (
          <TabsTrigger key={x.value} value={x.value}>
            {x.label}
            <Badge variant="outline" className="tabular">
              {x.count}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {shown.map((x) => (
        <TabsContent key={x.value} value={x.value} className="space-y-3">
          {x.body}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold leading-6">{children}</h2>;
}
