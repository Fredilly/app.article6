/**
 * Dev-only Fixture Replay UI overlay.
 *
 * Renders a side-by-side comparison of actual Quick Check output vs
 * expected fixture contract values. Only shown in non-production builds.
 *
 * The first visible mismatch:
 *   CCB report → actual: "VM0007" primary, expected: no primary methodology,
 *   VM0007 as supporting_carbon_accounting_reference only.
 */

"use client";

import { useMemo, useState } from "react";
import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";
import { compareWithFixture } from "@/lib/dev/fixtureReplay";

type Props = {
  preview: ExtractionPreviewViewModel | null;
  fileName: string | null;
};

export function FixtureReplayOverlay({ preview, fileName }: Props) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(
    () => preview !== null ? compareWithFixture(preview as ExtractionPreviewViewModel, fileName) : null,
    [preview, fileName],
  );

  if (!result) return null;

  const { comparisons, mismatchCount } = result;

  // Only show in non-production
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return null;
  }

  const allPass = mismatchCount === 0;

  return (
    <div className="mt-4 rounded-[1.5rem] border border-slate-300 bg-white shadow">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${allPass ? "bg-emerald-600" : "bg-rose-600"}`}>
            {allPass ? "✓" : "✗"}
          </span>
          <span className="text-sm font-semibold text-slate-900">Fixture Replay</span>
          <span className={`text-xs font-medium ${allPass ? "text-emerald-700" : "text-rose-700"}`}>
            {mismatchCount === 0 ? "All checks pass" : `${mismatchCount} mismatch(es)`}
          </span>
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {activeFixtureName(fileName)}
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-1.5 pr-2 font-medium">Check</th>
                <th className="pb-1.5 pr-2 font-medium">Actual</th>
                <th className="pb-1.5 pr-2 font-medium">Expected</th>
                <th className="pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comparison) => (
                <tr key={comparison.check} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{comparison.check}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{formatValue(comparison.actual)}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{formatValue(comparison.expected)}</td>
                  <td className="py-1.5">
                    {comparison.passed
                      ? <span className="inline-flex items-center gap-1 text-emerald-700">✓ Pass</span>
                      : <span className="inline-flex items-center gap-1 text-rose-700">✗ Fail</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!allPass && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>First visible mismatch:</strong>{" "}
              The CCB report currently shows VM0007 as primary methodology,
              but the fixture expects no primary methodology — VM0007 should
              only appear as supporting carbon-accounting reference.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function activeFixtureName(fileName: string | null): string {
  if (!fileName) return "Unknown file";
  if (fileName.includes("CCB_Validation")) return "CCB Validation Report (CCBA/CCB)";
  if (fileName.includes("VCS_Validation")) return "VCS Validation Report (VCS)";
  if (fileName.includes("PROJ_DESC")) return "Project Description / PDD (VCS+CCB)";
  if (fileName.includes("MONIT_REP")) return "Monitoring Report (VCS+CCB)";
  return "Unknown fixture";
}

function formatValue(value: string | null): string {
  if (value === null) return <span className="text-slate-400">null</span> as unknown as string;
  return value.length > 50 ? value.slice(0, 47) + "..." : value;
}
