import React from "react";
import type { EngineResult } from "@/lib/engine/types";

export function pickTitle(result: EngineResult) {
  return (
    result.section_title ??
    result.sectionTitle ??
    result.section ??
    result.text?.split("\n")[0]?.slice(0, 120) ??
    result.id
  );
}

export function pickBody(result: EngineResult) {
  return result.text ?? result.section ?? "";
}

export default function SidePane({ results }: { results: EngineResult[] }) {
  const hasResults = results?.length > 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-[1.25rem] border border-gray-200/60 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Insights</p>
        <h2 className="text-lg font-semibold text-gray-900">Rule cards</h2>
      </div>

      {hasResults ? (
        <ul className="space-y-3">
          {results.map((r) => {
            const title = pickTitle(r);
            const body = pickBody(r) || "No excerpt available.";
            return (
              <li
                key={r.id}
                className="group rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Section</p>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2" title={title}>
                      {title}
                    </h3>
                  </div>
                  {typeof r.score === "number" && (
                    <span className="rounded-full bg-gray-900/90 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                      {r.score.toFixed(2)}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-gray-600 line-clamp-4" title={body}>
                  {body}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                  <span className="max-w-full truncate font-mono text-gray-400" title={r.id}>
                    {r.id}
                  </span>
                  {r.refs?.length ? (
                    <span className="truncate" title={r.refs.join(", ")}>
                      refs: {r.refs.join(", ")}
                    </span>
                  ) : null}
                  {r.sha256 ? <span className="font-mono">sha256: {r.sha256}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          <p>Ask a question to see matched rules and supporting evidence.</p>
        </div>
      )}
    </div>
  );
}
