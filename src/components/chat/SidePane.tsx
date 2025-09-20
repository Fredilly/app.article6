import React from "react";
import type { EngineResult } from "@/lib/engine/types";

function pickTitle(result: EngineResult) {
  return (
    result.section_title ??
    result.sectionTitle ??
    result.section ??
    result.text?.split("\n")[0]?.slice(0, 120) ??
    result.id
  );
}

function pickBody(result: EngineResult) {
  return result.text ?? result.section ?? "";
}

export default function SidePane({ results }: { results: EngineResult[] }) {
  return (
    <div className="h-full p-4 space-y-3 overflow-y-auto">
      <h2 className="text-lg font-semibold">Rule cards</h2>
      {results?.length ? (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate" title={pickTitle(r)}>
                  {pickTitle(r)}
                </div>
                {typeof r.score === "number" && (
                  <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                    {r.score.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line mt-1 line-clamp-5">
                {pickBody(r) || "No excerpt available."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                <span className="font-mono truncate max-w-full" title={r.id}>
                  id: {r.id}
                </span>
                {r.refs?.length ? <span>refs: {r.refs.join(", ")}</span> : null}
                {r.sha256 ? <span className="font-mono">sha256: {r.sha256}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No results yet. Ask a question.</p>
      )}
    </div>
  );
}
