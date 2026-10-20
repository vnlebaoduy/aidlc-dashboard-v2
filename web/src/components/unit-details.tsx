// What a Unit of Work is, for a tooltip: slug, title and description from the run's own
// unit-of-work.md (server/scan/unit-info.ts), then the roster facts (kind, complexity,
// dependencies). Shared by the Construction matrix and the Overview Unit card so a unit
// reads the same wherever it is hovered. Workspace text stays text: `code` spans are
// split out as text nodes, never parsed as markup.

import type { MatrixUnit } from "@server/scan/matrix";

export function UnitDetails({ u, extra }: { u: MatrixUnit; extra?: React.ReactNode }) {
  const facts = [u.kind, u.info?.complexity].filter(Boolean).join(" · ");
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[11px] opacity-80">{u.name}</p>
      {u.info?.title ? <p className="text-sm font-semibold">{u.info.title}</p> : null}
      {u.info?.description ? (
        <p className="leading-relaxed">
          {u.info.description.split("`").map((part, i) =>
            i % 2 === 1 ? (
              <code
                key={`${i}:${part}`}
                className="rounded-sm bg-white/15 px-1 font-mono text-[0.92em]"
              >
                {part}
              </code>
            ) : (
              part
            ),
          )}
        </p>
      ) : null}
      {facts || u.dependsOn.length ? (
        <p className="opacity-80">
          {facts}
          {u.dependsOn.length ? `${facts ? " · " : ""}\u2190 ${u.dependsOn.join(", ")}` : ""}
        </p>
      ) : null}
      {extra ? <div className="border-t border-white/20 pt-1.5 opacity-90">{extra}</div> : null}
    </div>
  );
}
