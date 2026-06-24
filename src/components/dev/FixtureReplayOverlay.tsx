/**
 * Dev-only Fixture Replay UI overlay.
 *
 * Renders a side-by-side comparison of actual Quick Check output vs
 * expected fixture contract values.
 *
 * Only rendered in non-production environments. The fixture contract
 * must be pre-loaded server-side and passed in as a prop — this
 * component does NOT import fs or path.
 *
 * First observable mismatch:
 *   CCB report → actual "VM0007" primary, fixture expects no primary,
 *   VM0007 only as supporting carbon-accounting reference.
 */

"use client";

import { useMemo, useState } from "react";
import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";
import {
  compareWithFixture,
  type FixtureContract,
  type ComparisonResult,
} from "@/lib/dev/fixtureReplay";

type Props = {
  contract: FixtureContract | null;
  preview: ExtractionPreviewViewModel | null;
  fileName: string | null;
};

export function FixtureReplayOverlay({ contract, preview, fileName }: Props) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(
    () => preview !== null
      ? compareWithFixture(contract, preview, fileName)
      : null,
    [contract, preview, fileName],
  );

  // ── Guard: production env or no analysis yet ──
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return null;
  }
  if (!preview || !result) return null;

  const {
    summary,
    comparisons,
    mismatchCount,
    contractLoaded,
    contractError,
  } = result;

  // ── Contract didn't load — show error state visibly ──
  if (!contractLoaded) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-rose-300 bg-rose-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
          <span>⚠️</span> Fixture Replay: Contract not loaded
        </div>
        <div className="mt-2 text-xs text-rose-700">
          {contractError ?? "Unknown error loading contract"}
        </div>
      </div>
    );
  }

  // ── No matching fixture — file not in contract ──
  if (comparisons.length === 0) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white shadow">
        <div className="px-4 py-3 text-xs text-slate-500">
          Fixture Replay: {summary}
        </div>
      </div>
    );
  }

  // ── Show comparison table ──
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
            {activeFixtureLabel(fileName)}
          </div>
          <div className="mb-3 text-xs text-slate-600">{summary}</div>

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
              {comparisons.map((cmp) => (
                <ComparisonRow key={cmp.check} comparison={cmp} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({ comparison }: { comparison: ComparisonResult }) {
  const statusBadge = comparison.provenanceKnownGap
    ? <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">~ Known gap</span>
    : comparison.passed
    ? <span className="inline-flex items-center gap-1 text-emerald-700">✓ Pass</span>
    : <span className="inline-flex items-center gap-1 text-rose-700">✗ Fail</span>;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-2 font-medium text-slate-700">
        {comparison.label}
      </td>
      <td className="py-1.5 pr-2 text-slate-600">
        <FormatValue value={comparison.actual} />
      </td>
      <td className="py-1.5 pr-2 text-slate-600">
        <FormatValue value={comparison.expected} />
      </td>
      <td className="py-1.5">{statusBadge}</td>
    </tr>
  );
}

function FormatValue({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="text-slate-400 italic">null</span>;
  }
  if (value.length > 80) {
    return <span title={value}>{value.slice(0, 77)}...</span>;
  }
  return <>{value}</>;
}

function activeFixtureLabel(fileName: string | null): string {
  if (!fileName) return "Unknown file";
  if (fileName.includes("CCB_Validation")) return "CCB Validation (CCBA/CCB)";
  if (fileName.includes("VCS_Validation")) return "VCS Validation (VCS)";
  if (fileName.includes("PROJ_DESC")) return "PDD (VCS+CCB)";
  if (fileName.includes("MONIT_REP")) return "Monitoring Report (VCS+CCB)";
  return "Unknown fixture";
}
