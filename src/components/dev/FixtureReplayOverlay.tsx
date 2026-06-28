/**
 * Dev-only Fixture Replay UI overlay.
 *
 * Renders a side-by-side comparison of live Quick Check output vs
 * expected fixture contract values with three status categories:
 *
 *   pass      — observable and matches the fixture
 *   fail      — observable and contradicts the fixture
 *   known_gap — not observable from the extraction preview
 *
 * The overlay never implies full reliability when known gaps exist.
 * Counters clearly separate passed, failed, and not-validated checks.
 *
 * Only rendered in non-production environments.
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

  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return null;
  }
  if (!preview || !result) return null;

  const {
    summary,
    comparisons,
    passedCount,
    failedCount,
    knownGapCount,
    totalChecks,
    contractLoaded,
    contractError,
  } = result;

  // ── Contract load failure — visible error ──
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

  // ── No matching fixture ──
  if (comparisons.length === 0) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white shadow">
        <div className="px-4 py-3 text-xs text-slate-500">{summary}</div>
      </div>
    );
  }

  const hasFailures = failedCount > 0;
  const hasKnownGaps = knownGapCount > 0;

  // ── Overlay header ──
  return (
    <div className="mt-4 rounded-[1.5rem] border border-slate-300 bg-white shadow">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <StatusIcon hasFailures={hasFailures} hasKnownGaps={hasKnownGaps} />
          <span className="text-sm font-semibold text-slate-900">Fixture Replay</span>
          <span className={`text-xs font-medium ${
            hasFailures ? "text-rose-700" : hasKnownGaps ? "text-amber-700" : "text-emerald-700"
          }`}>
            {hasFailures ? `${failedCount} mismatch(es)` : hasKnownGaps ? `${knownGapCount} gap(s)` : "All checks pass"}
          </span>
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-3">
          {/* Fixture name */}
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {activeFixtureLabel(fileName)}
          </div>
          {/* Honest summary */}
          <div className="mb-3 text-xs text-slate-600">{summary}</div>

          {/* Counters row */}
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
              ✓ {passedCount} passed
            </span>
            {failedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800">
                ✗ {failedCount} failed
              </span>
            )}
            {knownGapCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                ~ {knownGapCount} not validated
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
              {totalChecks} total
            </span>
          </div>

          {/* Comparison table */}
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

// ─── Sub-components ──────────────────────────────────────────────────────

function StatusIcon({ hasFailures, hasKnownGaps }: { hasFailures: boolean; hasKnownGaps: boolean }) {
  if (hasFailures) {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">✗</span>;
  }
  if (hasKnownGaps) {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">~</span>;
  }
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>;
}

function ComparisonRow({ comparison }: { comparison: ComparisonResult }) {
  const { status } = comparison;
  const isKnownGap = status === "known_gap";

  const statusBadge = status === "pass"
    ? <span className="inline-flex items-center gap-1 text-emerald-700">✓ Pass</span>
    : status === "fail"
    ? <span className="inline-flex items-center gap-1 text-rose-700">✗ Fail</span>
    : <span className="inline-flex items-center gap-1 text-amber-700">~ Known gap</span>;

  return (
    <tr className={`border-b border-slate-100 last:border-0 ${isKnownGap ? "opacity-70" : ""}`}>
      <td className="py-1.5 pr-2 font-medium text-slate-700">{comparison.label}</td>
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
